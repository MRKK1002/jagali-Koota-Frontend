/**
 * localCache.js — Offline-first data cache for counter web app.
 *
 * Stores menu items, tables, and KOTs in IndexedDB so the app works
 * fully offline after the first online load, including after page refresh.
 *
 * DB: counter_cache_db  (separate from the sync queue DB)
 * Stores:
 *   menu_items  — keyPath: _id
 *   tables      — keyPath: _id
 *   kots        — keyPath: _id  (pending KOTs created offline or loaded from server)
 *   meta        — keyPath: key  (timestamps, branch info, etc.)
 */

import { businessDateKey } from './businessDay';

const DB_NAME = 'counter_cache_db';
const DB_VERSION = 2;

class LocalCache {
  constructor() {
    this._db = null;
    this._fallback = { menu_items: [], tables: [], kots: [], bills: [], meta: [] };
    this._ready = this._open();
  }

  _open() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('[localCache] IndexedDB unavailable — using in-memory fallback');
        return resolve();
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('menu_items')) {
          const ms = db.createObjectStore('menu_items', { keyPath: '_id' });
          ms.createIndex('branchId', 'branchId', { unique: false });
        }
        if (!db.objectStoreNames.contains('tables')) {
          const ts = db.createObjectStore('tables', { keyPath: '_id' });
          ts.createIndex('branchId', 'branchId', { unique: false });
        }
        if (!db.objectStoreNames.contains('kots')) {
          const ks = db.createObjectStore('kots', { keyPath: '_id' });
          ks.createIndex('branchId', 'branchId', { unique: false });
          ks.createIndex('paymentStatus', 'paymentStatus', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('bills')) {
          const bs = db.createObjectStore('bills', { keyPath: '_id' });
          bs.createIndex('branchId', 'branchId', { unique: false });
          bs.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
          bs.createIndex('savedAt', 'savedAt', { unique: false });
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve();
      };

      req.onerror = (e) => {
        console.warn('[localCache] Failed to open DB — using in-memory fallback:', e.target.error);
        resolve();
      };
    });
  }

  // ─── Generic helpers ──────────────────────────────────────────────────────

  _isFallback() { return !this._db; }

  _tx(store, mode = 'readonly') {
    return this._db.transaction(store, mode).objectStore(store);
  }

  _p(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async _getAll(storeName) {
    await this._ready;
    if (this._isFallback()) return [...(this._fallback[storeName] || [])];
    return this._p(this._tx(storeName).getAll());
  }

  async _putAll(storeName, items) {
    await this._ready;
    if (!Array.isArray(items) || items.length === 0) return;
    if (this._isFallback()) {
      this._fallback[storeName] = items;
      return;
    }
    const tx = this._db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    // Clear old data then write fresh
    await this._p(store.clear());
    for (const item of items) {
      store.put(item);
    }
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }

  async _put(storeName, item) {
    await this._ready;
    if (this._isFallback()) {
      const arr = this._fallback[storeName];
      const idx = arr.findIndex((x) => x._id === item._id || x.key === item.key);
      if (idx >= 0) arr[idx] = item; else arr.push(item);
      return;
    }
    return this._p(this._tx(storeName, 'readwrite').put(item));
  }

  async _delete(storeName, id) {
    await this._ready;
    if (this._isFallback()) {
      this._fallback[storeName] = this._fallback[storeName].filter(
        (x) => x._id !== id && x.key !== id
      );
      return;
    }
    return this._p(this._tx(storeName, 'readwrite').delete(id));
  }

  // ─── Meta helpers ─────────────────────────────────────────────────────────

  async getMeta(key) {
    await this._ready;
    if (this._isFallback()) {
      return this._fallback.meta.find((x) => x.key === key)?.value ?? null;
    }
    const rec = await this._p(this._tx('meta').get(key));
    return rec?.value ?? null;
  }

  async setMeta(key, value) {
    return this._put('meta', { key, value });
  }

  // ─── Menu Items ───────────────────────────────────────────────────────────

  /** Save all menu items for a branch (replaces existing cache). */
  async saveMenuItems(branchId, items) {
    // Ensure each item has _id
    const normalised = items.map((item) => ({
      ...item,
      _id: item._id || item.id,
      branchId,
    }));
    await this._putAll('menu_items', normalised);
    await this.setMeta(`menu_items_ts_${branchId}`, Date.now());
  }

  /** Get cached menu items for a branch. */
  async getMenuItems(branchId) {
    const all = await this._getAll('menu_items');
    return all.filter((x) => x.branchId === branchId);
  }

  /** Returns true if we have a non-empty menu cache for this branch. */
  async hasMenuItems(branchId) {
    const items = await this.getMenuItems(branchId);
    return items.length > 0;
  }

  // ─── Tables ───────────────────────────────────────────────────────────────

  async saveTables(branchId, tables) {
    const normalised = tables.map((t) => ({
      ...t,
      _id: t._id || t.id,
      branchId,
    }));
    await this._putAll('tables', normalised);
    await this.setMeta(`tables_ts_${branchId}`, Date.now());
  }

  async getTables(branchId) {
    const all = await this._getAll('tables');
    return all.filter((x) => x.branchId === branchId);
  }

  async hasTables(branchId) {
    const tables = await this.getTables(branchId);
    return tables.length > 0;
  }

  // ─── KOTs ─────────────────────────────────────────────────────────────────

  /**
   * Save KOTs fetched from server (replaces existing server-sourced KOTs).
   * Offline-created KOTs (isOffline: true) are preserved.
   */
  async saveKOTs(branchId, kots) {
    await this._ready;
    const normalised = kots.map((k) => ({
      ...k,
      _id: k._id || k.id,
      branchId,
    }));

    if (this._isFallback()) {
      // Keep offline KOTs, replace server ones
      const offlineKOTs = (this._fallback.kots || []).filter((k) => k.isOffline);
      this._fallback.kots = [...normalised, ...offlineKOTs];
      return;
    }

    // In IDB: clear server KOTs for this branch, keep offline ones
    const existing = await this._getAll('kots');
    const offlineKOTs = existing.filter((k) => k.branchId === branchId && k.isOffline);
    const otherBranchKOTs = existing.filter((k) => k.branchId !== branchId);

    const tx = this._db.transaction('kots', 'readwrite');
    const store = tx.objectStore('kots');
    await this._p(store.clear());
    for (const k of [...normalised, ...offlineKOTs, ...otherBranchKOTs]) {
      store.put(k);
    }
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }

  /** Add or update a single KOT (used when saving offline KOTs). */
  async putKOT(kot) {
    const normalised = { ...kot, _id: kot._id || kot.id };
    return this._put('kots', normalised);
  }

  /** Get all pending KOTs for a branch (from cache). */
  async getPendingKOTs(branchId) {
    const all = await this._getAll('kots');
    return all.filter(
      (k) => k.branchId === branchId && k.paymentStatus === 'pending'
    );
  }

  /** Get all KOTs for a branch (any status). */
  async getKOTs(branchId) {
    const all = await this._getAll('kots');
    return all.filter((k) => k.branchId === branchId);
  }

  /** Mark a cached KOT as consolidated. */
  async markKOTConsolidated(kotId) {
    await this._ready;
    if (this._isFallback()) {
      const k = this._fallback.kots.find((x) => x._id === kotId);
      if (k) { k.paymentStatus = 'consolidated'; k.status = 'consolidated'; }
      return;
    }
    const store = this._tx('kots', 'readwrite');
    const kot = await this._p(store.get(kotId));
    if (kot) {
      kot.paymentStatus = 'consolidated';
      kot.status = 'consolidated';
      await this._p(this._tx('kots', 'readwrite').put(kot));
    }
  }

  /** Remove a KOT from cache by id. */
  async removeKOT(kotId) {
    return this._delete('kots', kotId);
  }

  async hasKOTs(branchId) {
    const kots = await this.getKOTs(branchId);
    return kots.length > 0;
  }

  // ─── Bill number counter seeding ─────────────────────────────────────────

  /**
   * Seed local localStorage counters from server values so local numbering
   * continues from where the server left off. Call this on app init when online.
   *
   * @param {string} branchId
   * @param {Array<{category: string, lastBillNumber: number, lastKOTNumber: number}>} counters
   */
  seedLocalCounters(branchId, counters) {
    if (!Array.isArray(counters) || counters.length === 0) return

    // Business day (3 AM cutoff) — must match the key used when generating
    // numbers, otherwise seeding writes to a key nobody reads.
    const dateKey = businessDateKey()

    for (const c of counters) {
      // Seed bill counter for each category
      if (c.category && typeof c.lastBillNumber === 'number') {
        const billKey = `unified-bill-counter-${c.category}-${dateKey}`
        const localVal = parseInt(localStorage.getItem(billKey) || '0')
        if (c.lastBillNumber > localVal) {
          localStorage.setItem(billKey, String(c.lastBillNumber))
          console.log(`[localCache] Seeded bill counter for ${c.category}: ${c.lastBillNumber}`)
        }
      }
      // Seed KOT counter (only from Restaurant category counter)
      if (c.category === 'Restaurant' && typeof c.lastKOTNumber === 'number') {
        const kotKey = `kot-counter-${dateKey}`
        const localVal = parseInt(localStorage.getItem(kotKey) || '0')
        if (c.lastKOTNumber > localVal) {
          localStorage.setItem(kotKey, String(c.lastKOTNumber))
          console.log(`[localCache] Seeded KOT counter: ${c.lastKOTNumber}`)
        }
      }
    }
  }

  // ─── Bills ────────────────────────────────────────────────────────────────

  /**
   * Save a bill locally (called immediately when a bill is generated, before server sync).
   */
  async saveBill(bill) {
    const normalised = {
      ...bill,
      _id: bill._id || bill.invoiceNumber || `bill-${Date.now()}`,
      savedAt: bill.savedAt || Date.now(),
      synced: bill.synced ?? false,
    };
    return this._put('bills', normalised);
  }

  /** Get all bills for a branch. */
  async getBills(branchId) {
    const all = await this._getAll('bills');
    return all.filter((b) => b.branchId === branchId);
  }

  /** Mark a bill as synced to server. */
  async markBillSynced(invoiceNumber) {
    await this._ready;
    if (this._isFallback()) {
      const b = this._fallback.bills.find((x) => x.invoiceNumber === invoiceNumber);
      if (b) b.synced = true;
      return;
    }
    const all = await this._getAll('bills');
    const bill = all.find((b) => b.invoiceNumber === invoiceNumber);
    if (bill) {
      bill.synced = true;
      await this._put('bills', bill);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  /**
   * Delete bills older than `daysToKeep` days from the local cache.
   * Call this on app startup to prevent unbounded growth.
   */
  async purgeStaleBills(daysToKeep = 7) {
    await this._ready;
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    if (this._isFallback()) {
      this._fallback.bills = this._fallback.bills.filter(b => {
        const ts = typeof b.savedAt === 'number' ? b.savedAt : new Date(b.savedAt).getTime();
        return ts >= cutoff;
      });
      return;
    }
    const all = await this._getAll('bills');
    const stale = all.filter(b => {
      const ts = typeof b.savedAt === 'number' ? b.savedAt : new Date(b.savedAt).getTime();
      return ts < cutoff;
    });
    if (stale.length === 0) return;
    const tx = this._db.transaction('bills', 'readwrite');
    const store = tx.objectStore('bills');
    for (const b of stale) store.delete(b._id);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    console.log(`[localCache] Purged ${stale.length} stale bills (older than ${daysToKeep} days)`);
  }

  /**
   * Clean up stale localStorage counter keys from previous BUSINESS days.
   *
   * Must use the business-day key, not the calendar key. With a calendar key
   * this ran at 00:05 and deleted the counter for the still-active session
   * (whose key is the previous date), resetting numbering to 001 mid-service.
   */
  purgeStaleLocalStorageKeys() {
    const todayKey = businessDateKey();
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        (key.startsWith('unified-bill-counter-') || key.startsWith('kot-counter-')) &&
        !key.endsWith(todayKey)
      ) {
        toDelete.push(key);
      }
      // Clean up stale SalesReports cache entries
      if (key.startsWith('sales_report_')) {
        try {
          const cached = JSON.parse(localStorage.getItem(key) || '{}');
          if (cached.expiresIn && Date.now() > cached.expiresIn) toDelete.push(key);
        } catch (_) { toDelete.push(key); }
      }
    }
    toDelete.forEach(k => localStorage.removeItem(k));
    if (toDelete.length > 0) console.log(`[localCache] Purged ${toDelete.length} stale localStorage keys`);
  }

  // ─── Offline-ID → Server-ID mapping ──────────────────────────────────────

  /**
   * Persist the offline-id → server-id map so it survives page reloads.
   * @param {Object} map — plain object { 'offline-1': 'abc123', ... }
   */
  async setOfflineIdMap(map) {
    return this.setMeta('offline_id_map', map);
  }

  /**
   * Retrieve the persisted offline-id → server-id map.
   * @returns {Promise<Object>} — plain object (empty if not set)
   */
  async getOfflineIdMap() {
    const map = await this.getMeta('offline_id_map');
    return map && typeof map === 'object' ? map : {};
  }
}

export const localCache = new LocalCache();
