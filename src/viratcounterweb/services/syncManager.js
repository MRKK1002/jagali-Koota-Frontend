/**
 * syncManager.js — Network detection and offline queue sync orchestration.
 * Registers online/offline listeners and flushes pending entries to the backend.
 */

import { offlineQueue as defaultOfflineQueue } from './offlineQueue.js';
import counterApiDefault from './counterApi.js';
import { localCache } from './localCache.js';

export class SyncManager {
  /**
   * @param {object} [deps] — optional dependency injection for testability
   * @param {object} [deps.offlineQueue] — offlineQueue instance
   * @param {object} [deps.counterApi]   — counterApi instance
   */
  constructor(deps = {}) {
    this._queue = deps.offlineQueue ?? defaultOfflineQueue;
    this._api = deps.counterApi ?? counterApiDefault;
    this._online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this._syncing = false;
    this._lastSyncAt = 0;          // timestamp of last completed sync
    this._onlineCooldownTimer = null; // debounce rapid online events
    // Maps 'offline-<queueId>' → real server _id, persisted across page reloads
    this._offlineIdMap = {};
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Register window online/offline listeners and trigger an initial sync if
   * the app starts while online with pending entries.
   */
  init() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);

    this._online = navigator.onLine;

    // Expose on window for manual debugging / forced retry from console
    window.__syncManager = this;

    // Load persisted offline-id → server-id map FIRST, then trigger sync
    // so the map is populated before any kot_status_update entries are processed
    localCache.getOfflineIdMap()
      .then((map) => {
        this._offlineIdMap = map;
      })
      .catch(() => {})
      .finally(() => {
        if (this._online) {
          this._queue.countPending().then((count) => {
            if (count > 0) this.triggerSync();
          });
        }
      });
  }

  /** Returns the current network state. */
  isOnline() {
    return this._online;
  }

  /**
   * Called by pages when a fetch fails — immediately marks state as offline
   * so no further sync attempts are made until the browser fires 'online'.
   */
  handleNetworkError() {
    this._online = false;
  }

  /**
   * Process all pending_sync entries one at a time in FIFO order.
   * Guards against concurrent invocations with the _syncing flag.
   */
  async triggerSync() {
    if (this._syncing) {
      console.log('[syncManager] Already syncing, skipping');
      return;
    }
    this._syncing = true;

    let syncedCount = 0;
    const syncErrors = [];

    try {
      // Reset permanently failed entries so they get one more chance on manual sync
      await this._queue.resetFailedEntries().catch(() => {});

      const pending = await this._queue.listPending();
      console.log('[syncManager] triggerSync — pending entries:', pending.length);

      for (const entry of pending) {
        const label =
          entry.payload.kotNumber ||
          entry.payload.invoiceNumber ||
          entry.payload.orderId ||
          entry.id;

        console.log('[syncManager] Syncing entry', entry.id, entry.type, label);

        try {
          await this._syncEntry(entry);
          syncedCount++;
          console.log('[syncManager] Synced entry', entry.id, entry.type, label);
        } catch (err) {
          const errMsg = err?.serverMessage || err?.message || String(err);
          console.warn('[syncManager] Failed entry', entry.id, entry.type, label,
            '| status:', err?.status,
            '| message:', errMsg
          );
          syncErrors.push({ id: entry.id, type: entry.type, label, error: errMsg });
          await this._queue.markFailed(entry.id);
        }
      }

      // Expose last sync errors on window for debugging
      if (typeof window !== 'undefined') {
        window.__syncErrors = syncErrors;
        if (syncErrors.length > 0) {
          console.error('[syncManager] Sync completed with errors:', syncErrors);
        }
      }

      // After sync, refresh the local cache with fresh server data
      await this._refreshCacheAfterSync();
    } finally {
      this._syncing = false;
      this._lastSyncAt = Date.now();
      if (typeof window !== 'undefined') {
        window.__salesReportSyncedCount = syncedCount;
        window.dispatchEvent(new CustomEvent('offlineSyncComplete', { detail: { syncedCount, errors: syncErrors } }));
      }
    }
  }

  /**
   * Re-fetch KOTs from server and update local cache after a successful sync.
   * Silently ignores errors — cache will be refreshed on next online load.
   */
  async _refreshCacheAfterSync() {
    try {
      const branchId = await localCache.getMeta('current_branch_id');
      if (!branchId) return;

      // Scope all fetches to today — at 1000 bills/day, fetching all-time would load
      // thousands of records into RAM and cause slowdowns on low-end devices
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      // Refresh KOT list (pending only — no need to load completed KOTs)
      const response = await this._api.request(
        `/counter-order/orders?branchId=${branchId}&paymentStatus=pending&includeComplimentary=false&limit=500`
      );
      let kots = [];
      if (response?.success && Array.isArray(response.orders)) kots = response.orders;
      else if (Array.isArray(response?.orders)) kots = response.orders;
      else if (Array.isArray(response?.data)) kots = response.data;
      else if (Array.isArray(response)) kots = response;
      await localCache.saveKOTs(branchId, kots);

      // Backfill mongoId for today's local bills that are missing it
      const billRes = await this._api.request(
        `/counter-order/orders?branchId=${branchId}&startDate=${todayStart}&endDate=${todayEnd}&limit=2000`
      );
      let serverBills = [];
      if (Array.isArray(billRes?.data)) serverBills = billRes.data;
      else if (Array.isArray(billRes?.orders)) serverBills = billRes.orders;
      else if (Array.isArray(billRes)) serverBills = billRes;

      if (serverBills.length > 0) {
        const serverMap = new Map();
        for (const o of serverBills) {
          if (o.invoiceNumber) serverMap.set(o.invoiceNumber, o.id || o._id);
        }
        // Only check today's local bills — older ones are already synced
        const localBills = await localCache.getBills(branchId);
        const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayBills = localBills.filter(b => {
          const ts = typeof b.savedAt === 'number' ? b.savedAt : new Date(b.savedAt).getTime();
          return ts >= todayMs;
        });
        for (const bill of todayBills) {
          if (!bill.invoiceNumber) continue;
          const realId = serverMap.get(bill.invoiceNumber);
          if (realId && (!bill.mongoId || bill.mongoId !== realId)) {
            localCache.saveBill({ ...bill, mongoId: realId, synced: true }).catch(() => {});
          }
        }

        // Recovery: find KOTs still 'pending' on server that should be 'consolidated'
        const pendingKotIds = new Set(
          kots
            .filter(k => k.paymentStatus === 'pending')
            .map(k => String(k.id || k._id))
            .filter(id => /^[0-9a-fA-F]{24}$/.test(id))
        );
        if (pendingKotIds.size > 0) {
          for (const bill of todayBills) {
            const kotIds = bill.existingOrderIds || bill.originalKOTIds || [];
            for (const id of kotIds) {
              if (!id) continue;
              const resolvedId = String(id).startsWith('offline-')
                ? (this._offlineIdMap[id] ?? null)
                : String(id);
              if (!resolvedId || !/^[0-9a-fA-F]{24}$/.test(resolvedId)) continue;
              if (pendingKotIds.has(resolvedId)) {
                console.log('[syncManager] Recovery: marking stuck KOT as consolidated:', resolvedId);
                this._api.request(`/counter-order/orders/${resolvedId}/payment-status`, {
                  method: 'PUT',
                  body: JSON.stringify({ paymentStatus: 'consolidated' }),
                }).catch(() => {});
              }
            }
          }
        }
      }
    } catch (_) {
      // Silently ignore — not critical
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _handleOnline = () => {
    this._online = true;
    // Debounce: ignore rapid online/offline flicker within 2 seconds
    if (this._onlineCooldownTimer) clearTimeout(this._onlineCooldownTimer);
    this._onlineCooldownTimer = setTimeout(() => {
      this._onlineCooldownTimer = null;
      console.log('[syncManager] Network online — triggering sync');
      this.triggerSync();
    }, 2000);
  };

  _handleOffline = () => {
    this._online = false;
  };

  /**
   * Sync a single entry. Throws on non-409 errors so the caller can markFailed.
   */
  async _syncEntry(entry) {
    try {
      if (entry.type === 'kot') {
        // Guard: skip if this kotNumber was already synced (duplicate enqueue)
        const existingServerKOT = await this._isAlreadySyncedKOT(entry.payload.kotNumber, entry.payload.branchId);
        if (existingServerKOT) {
          console.log('[syncManager] KOT already on server, skipping upload:', entry.payload.kotNumber);
          // Populate offlineIdMap so subsequent kot_status_update entries can resolve this ID
          const realId = existingServerKOT.id || existingServerKOT._id || null;
          if (realId) {
            const offlineKey = `offline-${entry.id}`;
            this._offlineIdMap[offlineKey] = realId;
            localCache.setOfflineIdMap(this._offlineIdMap).catch(() => {});
          }
          await this._queue.markSynced(entry.id);
          return;
        }

        // Recover categoryName/categoryId from localStorage if missing in KOT payload
        const kotPayload = { ...entry.payload };
        if (!kotPayload.categoryName) {
          try {
            const storedCategoryName = localStorage.getItem('selectedCategoryName');
            const storedCategory = localStorage.getItem('selectedCategory');
            if (storedCategoryName) kotPayload.categoryName = storedCategoryName;
            if (!kotPayload.categoryId && storedCategory) {
              const cat = JSON.parse(storedCategory);
              kotPayload.categoryId = cat?._id || cat?.id || null;
            }
          } catch (_) {}
        }

        const response = await this._api.createOrder(kotPayload);

        // Extract the real server-assigned _id from the response
        const realId =
          response?.order?._id ||
          response?.order?.id ||
          response?._id ||
          response?.id ||
          null;

        if (realId) {
          // Store mapping: 'offline-<queueId>' → realId
          const offlineKey = `offline-${entry.id}`;
          this._offlineIdMap[offlineKey] = realId;
          // Persist so it survives page reloads
          localCache.setOfflineIdMap(this._offlineIdMap).catch(() => {});
        }

        await this._queue.markSynced(entry.id);

      } else if (entry.type === 'bill') {
        // NOTE: Pre-upload dedup check removed — it caused false positives (same invoice number
        // from a different day matched, bill was silently skipped and never reached the server).
        // We now rely solely on the server's 409 duplicate response to detect true duplicates.
        // The _is409 handler below marks the entry as synced if the server rejects with 409.

        // Helper: return value only if it's a valid 24-char MongoDB ObjectId, else null
        const validObjectId = (v) =>
          v && /^[0-9a-fA-F]{24}$/.test(String(v)) ? v : null;

        // Sanitize payload before upload — fix any fields that would fail server validation
        const sanitizedPayload = {
          ...entry.payload,
          // Ensure phone number is always a valid 10-digit string
          phoneNumber: /^\d{10}$/.test(entry.payload.phoneNumber || '')
            ? entry.payload.phoneNumber
            : '0000000000',
          // Ensure paymentMethod is valid
          paymentMethod: ['cash', 'card', 'upi', 'qr'].includes(entry.payload.paymentMethod)
            ? entry.payload.paymentMethod
            : 'cash',
          // Ensure customerName is not empty
          customerName: entry.payload.customerName || 'Walk-in Customer',
          // Sanitize ObjectId fields — invalid values cause Mongoose CastError (500) on server
          categoryId: validObjectId(entry.payload.categoryId),
          tableId: validObjectId(entry.payload.tableId),
          userId: validObjectId(entry.payload.userId),
        };

        // Recover categoryName/categoryId from localStorage if missing in payload
        if (!sanitizedPayload.categoryName) {
          try {
            const storedCategoryName = localStorage.getItem('selectedCategoryName');
            const storedCategory = localStorage.getItem('selectedCategory');
            if (storedCategoryName) sanitizedPayload.categoryName = storedCategoryName;
            if (!sanitizedPayload.categoryId && storedCategory) {
              const cat = JSON.parse(storedCategory);
              sanitizedPayload.categoryId = cat?._id || cat?.id || null;
            }
          } catch (_) {}
        }

        // Try to populate userId from localStorage as best-effort
        if (!sanitizedPayload.userId) {
          try {
            const cu = JSON.parse(localStorage.getItem('counterUserData') || '{}');
            sanitizedPayload.userId = cu._id || cu.id || null;
          } catch (_) {}
        }

        // Ensure items array is valid
        if (!sanitizedPayload.items || sanitizedPayload.items.length === 0) {
          console.warn('[syncManager] Bill has no items, skipping (unrecoverable):', sanitizedPayload.invoiceNumber);
          await this._queue.markSynced(entry.id);
          return;
        }
        // Ensure every item has a menuItemId
        sanitizedPayload.items = sanitizedPayload.items.map(item => ({
          ...item,
          menuItemId: item.menuItemId || item._id || item.id || '507f1f77bcf86cd799439013',
        }));

        console.log('[syncManager] Uploading bill to server:', sanitizedPayload.invoiceNumber, {
          branchId: sanitizedPayload.branchId,
          userId: sanitizedPayload.userId,
          totalAmount: sanitizedPayload.totalAmount,
          itemCount: sanitizedPayload.items?.length,
          paymentMethod: sanitizedPayload.paymentMethod,
          items: sanitizedPayload.items?.map(i => ({ name: i.name, menuItemId: i.menuItemId, qty: i.quantity, price: i.price })),
        });

        const billResponse = await this._api.createOrder(sanitizedPayload);
        console.log('[syncManager] Bill uploaded to server:', sanitizedPayload.invoiceNumber);

        // Mark bill as synced and store the real MongoDB _id so cancel/edit works
        const realBillId = billResponse?.order?._id || billResponse?.order?.id || billResponse?._id || billResponse?.id || null;
        localCache.markBillSynced(sanitizedPayload.invoiceNumber).catch(() => {});
        if (realBillId) {
          // Update the localCache bill record with the real server _id
          localCache.getBills(sanitizedPayload.branchId).then(bills => {
            const bill = bills.find(b => b.invoiceNumber === sanitizedPayload.invoiceNumber);
            if (bill) {
              localCache.saveBill({ ...bill, mongoId: realBillId, synced: true }).catch(() => {});
            }
          }).catch(() => {});
        }

        // Resolve any offline-* IDs in existingOrderIds to real server IDs
        // and mark those KOTs as consolidated on the server
        const ids = sanitizedPayload.existingOrderIds ?? [];
        for (const id of ids) {
          if (!id) continue;
          const resolvedId = String(id).startsWith('offline-')
            ? (this._offlineIdMap[id] ?? null)
            : id;

          if (!resolvedId) {
            console.warn('[syncManager] Cannot resolve offline ID', id, '— skipping payment-status update');
            continue;
          }

          // Only call payment-status if resolvedId is a valid MongoDB ObjectId
          if (!/^[0-9a-fA-F]{24}$/.test(String(resolvedId))) {
            console.warn('[syncManager] Skipping payment-status update — not a valid ObjectId:', resolvedId);
            continue;
          }

          await this._api.request(`/counter-order/orders/${resolvedId}/payment-status`, {
            method: 'PUT',
            body: JSON.stringify({ paymentStatus: 'consolidated' }),
          }).catch(err => {
            console.warn('[syncManager] Failed to mark KOT consolidated:', resolvedId, err?.message);
          });
        }

        await this._queue.markSynced(entry.id);
      } else if (entry.type === 'kot_status_update') {
        let orderId = entry.payload.orderId;

        if (orderId.startsWith('offline-')) {
          const resolvedId = this._offlineIdMap[orderId] ?? null;
          console.log('[syncManager] kot_status_update: resolving', orderId, '→', resolvedId, '| map keys:', Object.keys(this._offlineIdMap));
          if (!resolvedId) {
            // Check if there's still a pending KOT entry for this offline ID
            // If yes — defer (KOT will sync first and populate the map)
            // If no  — the KOT was synced in a previous session without map recording;
            //          we can't recover the real ID, so skip to avoid infinite retry
            const pending = await this._queue.listPending();
            const kotQueueId = orderId.replace('offline-', '');
            const kotStillPending = pending.some(
              (e) => e.type === 'kot' && String(e.id) === String(kotQueueId)
            );
            if (kotStillPending) {
              throw new Error(`[syncManager] Cannot resolve offline ID ${orderId} — deferring until KOT syncs`);
            } else {
              // KOT was synced in a previous session without map recording.
              // If we have a kotNumber, look it up on the server to get the real ID.
              const kotNumber = entry.payload.kotNumber;
              if (kotNumber) {
                const branchId = await localCache.getMeta('current_branch_id');
                const serverKOT = await this._isAlreadySyncedKOT(kotNumber, branchId).catch(() => null);
                if (serverKOT) {
                  const realId = serverKOT.id || serverKOT._id;
                  if (realId) {
                    // Populate map for future use
                    this._offlineIdMap[orderId] = realId;
                    localCache.setOfflineIdMap(this._offlineIdMap).catch(() => {});
                    orderId = realId;
                    console.log('[syncManager] kot_status_update: resolved via kotNumber lookup:', kotNumber, '→', realId);
                    // Fall through to the API call below
                  } else {
                    console.warn('[syncManager] Cannot resolve offline ID', orderId, '— KOT already synced without map; skipping status update');
                    await this._queue.markSynced(entry.id);
                    return;
                  }
                } else {
                  console.warn('[syncManager] Cannot resolve offline ID', orderId, '— KOT not found by kotNumber; skipping status update');
                  await this._queue.markSynced(entry.id);
                  return;
                }
              } else {
                console.warn('[syncManager] Cannot resolve offline ID', orderId, '— KOT already synced without map; skipping status update');
                await this._queue.markSynced(entry.id);
                return;
              }
            }
          }
          // Only overwrite orderId with resolvedId if it was successfully resolved from the map
          // (kotNumber fallback path sets orderId directly above)
          if (orderId.startsWith('offline-')) {
            orderId = resolvedId;
          }
        }

        // Skip if orderId is not a valid MongoDB ObjectId (e.g. invoice number string)
        if (!/^[0-9a-fA-F]{24}$/.test(String(orderId))) {
          console.warn('[syncManager] kot_status_update: orderId is not a valid ObjectId, skipping:', orderId);
          await this._queue.markSynced(entry.id);
          return;
        }

        console.log('[syncManager] kot_status_update: calling payment-status API for orderId:', orderId, '| status:', entry.payload.paymentStatus);
        await this._api.request(
          `/counter-order/orders/${orderId}/payment-status`,
          {
            method: 'PUT',
            body: JSON.stringify({ paymentStatus: entry.payload.paymentStatus }),
          }
        );
        console.log('[syncManager] kot_status_update: payment-status updated successfully for:', orderId);
        await this._queue.markSynced(entry.id);

      } else if (entry.type === 'kot_partial_update') {
        // Split bill: update a KOT with remaining items after partial billing
        let orderId = entry.payload.orderId;

        // Skip if orderId is not a valid MongoDB ObjectId
        if (!/^[0-9a-fA-F]{24}$/.test(String(orderId))) {
          console.warn('[syncManager] kot_partial_update: orderId is not a valid ObjectId, skipping:', orderId);
          await this._queue.markSynced(entry.id);
          return;
        }

        console.log('[syncManager] kot_partial_update: updating KOT items for orderId:', orderId);
        await this._api.request(
          `/counter-order/orders/${orderId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: entry.payload.items,
              totalAmount: entry.payload.totalAmount,
              grandTotal: entry.payload.totalAmount,
              subtotal: entry.payload.totalAmount
            })
          }
        );
        console.log('[syncManager] kot_partial_update: KOT updated successfully for:', orderId);
        await this._queue.markSynced(entry.id);

      } else {
        // Unknown type — treat as unrecoverable, mark synced to avoid infinite loop
        console.warn('[syncManager] Unknown entry type:', entry.type, '— marking synced');
        await this._queue.markSynced(entry.id);
      }
    } catch (err) {
      if (_is409(err)) {
        // Duplicate key — treat as success
        console.log('[syncManager] 409 duplicate for entry', entry.id, '— marking synced');
        await this._queue.markSynced(entry.id);
        return;
      }
      if (_is400(err)) {
        const msg = String(err?.message ?? err).toLowerCase();
        // Only permanently skip truly unrecoverable validation errors
        const unrecoverable = msg.includes('items are required') || msg.includes('branch is required') || msg.includes('invalid branchid format');
        if (unrecoverable) {
          console.warn('[syncManager] Unrecoverable 400 for entry', entry.id, entry.type, '—', err?.message, '— skipping permanently');
          await this._queue.markSynced(entry.id);
          return;
        }
        // Other 400s (e.g. "Invalid order ID format" from KOT status update) — log but keep retrying
        console.warn('[syncManager] 400 error for entry', entry.id, entry.type, '—', err?.message, '— will retry');
        throw err;
      }
      throw err;
    }
  }
  /**
   * Check if a KOT with this kotNumber already exists on the server.
   * Returns the matching server order object if found, or null if not found.
   */
  async _isAlreadySyncedKOT(kotNumber, branchId) {
    try {
      // Scope to today to avoid matching same KOT numbers from previous days (they reset daily)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const res = await this._api.request(
        `/counter-order/orders?branchId=${branchId}&search=${encodeURIComponent(kotNumber)}&startDate=${startOfDay}&endDate=${endOfDay}&limit=5`
      );
      const orders = res?.orders ?? res?.data ?? (Array.isArray(res) ? res : []);
      if (!Array.isArray(orders)) return null;
      return orders.find(o => o.kotNumber === kotNumber) ?? null;
    } catch {
      return null; // Can't confirm — let the upload proceed (409 will catch true duplicates)
    }
  }

  /**
   * Check if a bill with this invoiceNumber already exists on the server AS A COMPLETED BILL.
   * Returns the matching server order object if found, or null if not found.
   *
   * IMPORTANT: We only match documents with paymentStatus 'completed' or orderStatus 'completed'.
   * KOT documents may also have invoiceNumber set (from payment-status updates) but they are NOT
   * bills — matching them would cause the real bill upload to be skipped.
   */
  async _isAlreadySyncedBill(invoiceNumber, branchId) {
    if (!invoiceNumber) return null;
    try {
      // Build a date range for today (local time) to avoid matching same invoice numbers from previous days
      // Invoice numbers reset daily (001, 002...) so we must scope the check to today
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const res = await this._api.request(
        `/counter-order/orders?branchId=${branchId}&invoiceNumber=${encodeURIComponent(invoiceNumber)}&startDate=${startOfDay}&endDate=${endOfDay}&limit=10`
      );
      const orders = res?.orders ?? res?.data ?? (Array.isArray(res) ? res : []);
      if (!Array.isArray(orders)) return null;
      // Only treat as "already synced" if the document is a completed BILL (not a KOT).
      // A real bill has: paymentStatus='completed', orderStatus='completed', and NO kotNumber.
      return orders.find(o =>
        o.invoiceNumber === invoiceNumber &&
        (o.paymentStatus === 'completed' || o.orderStatus === 'completed') &&
        !o.kotNumber // exclude KOT documents — they are not bills
      ) ?? null;
    } catch {
      return null; // Can't confirm — let upload proceed, 409 will catch true duplicates
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _is409(err) {
  if (!err) return false;
  if (err.status === 409) return true;
  const msg = String(err.message ?? err);
  return msg.includes('409') || msg.toLowerCase().includes('duplicate');
}

function _is400(err) {
  if (!err) return false;
  if (err.status === 400) return true;
  const msg = String(err.message ?? err);
  // Only match explicit 400 responses — not connection errors that happen to contain these words
  return msg.startsWith('400:') || msg.startsWith('400 ');
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const syncManager = new SyncManager();
