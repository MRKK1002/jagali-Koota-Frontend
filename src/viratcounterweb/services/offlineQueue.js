/**
 * offlineQueue.js — IndexedDB-backed offline queue for counter web app.
 * Falls back to an in-memory array if IndexedDB is unavailable (e.g. private browsing).
 */

const DB_NAME = 'counter_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_queue';

// Required fields per entry type
const REQUIRED_FIELDS = {
  kot: ['items', 'branchId', 'kotNumber'],
  bill: ['invoiceNumber'],
  kot_status_update: ['orderId', 'paymentStatus'],
  kot_partial_update: ['orderId', 'items'],
};

export class OfflineQueue {
  /**
   * @param {IDBFactory} [idbFactory] — optional IDB factory (defaults to globalThis.indexedDB).
   *   Pass a fake-indexeddb IDBFactory instance in tests for isolation.
   */
  constructor(idbFactory) {
    this._idbFactory = idbFactory ?? (typeof indexedDB !== 'undefined' ? indexedDB : null);
    this._db = null;          // IDBDatabase instance once opened
    this._fallback = null;    // in-memory array used when IDB is unavailable
    this._fallbackIdSeq = 0;  // auto-increment counter for fallback mode
    this._ready = this._open();
  }

  // ─── Internal: open / init DB ────────────────────────────────────────────

  _open() {
    return new Promise((resolve) => {
      if (!this._idbFactory) {
        this._initFallback();
        return resolve();
      }

      let req;
      try {
        req = this._idbFactory.open(DB_NAME, DB_VERSION);
      } catch (err) {
        console.warn('[offlineQueue] indexedDB.open() threw — using in-memory fallback:', err);
        this._initFallback();
        return resolve();
      }

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      req.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      req.onerror = (event) => {
        console.warn('[offlineQueue] Failed to open IndexedDB — using in-memory fallback:', event.target.error);
        this._initFallback();
        resolve();
      };

      req.onblocked = () => {
        console.warn('[offlineQueue] IndexedDB open blocked — using in-memory fallback');
        this._initFallback();
        resolve();
      };
    });
  }

  _initFallback() {
    if (!this._fallback) this._fallback = [];
  }

  // ─── Internal: IDB transaction helpers ───────────────────────────────────

  _tx(mode) {
    return this._db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  _promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  _validate(type, payload) {
    const required = REQUIRED_FIELDS[type];
    if (!required) throw new Error(`[offlineQueue] Unknown entry type: "${type}"`);
    for (const field of required) {
      if (payload[field] === undefined || payload[field] === null) {
        throw new Error(`[offlineQueue] Missing required field "${field}" for type "${type}"`);
      }
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Enqueue a new entry.
   * @param {'kot'|'bill'|'kot_status_update'} type
   * @param {object} payload
   * @returns {Promise<object>} the stored entry (with id assigned)
   */
  async enqueue(type, payload) {
    await this._ready;
    this._validate(type, payload);

    const entry = {
      type,
      payload,
      status: 'pending_sync',
      createdAt: new Date().toISOString(),
    };

    if (this._fallback) {
      entry.id = ++this._fallbackIdSeq;
      this._fallback.push({ ...entry });
      return { ...entry };
    }

    const store = this._tx('readwrite');
    const id = await this._promisify(store.add(entry));
    return { ...entry, id };
  }

  /**
   * Returns all pending_sync entries ordered by createdAt ASC.
   * @param {boolean} [includeFailedPermanent=false] — also include failed_permanent entries
   * @returns {Promise<object[]>}
   */
  async listPending(includeFailedPermanent = false) {
    await this._ready;

    const statuses = includeFailedPermanent
      ? ['pending_sync', 'failed_permanent']
      : ['pending_sync'];

    if (this._fallback) {
      return this._fallback
        .filter((e) => statuses.includes(e.status))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    return new Promise((resolve, reject) => {
      const store = this._tx('readonly');
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || [])
          .filter(e => statuses.includes(e.status))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Mark an entry as synced.
   * @param {number} id
   */
  async markSynced(id) {
    await this._ready;

    if (this._fallback) {
      const entry = this._fallback.find((e) => e.id === id);
      if (entry) entry.status = 'synced';
      return;
    }

    const store = this._tx('readwrite');
    const entry = await this._promisify(store.get(id));
    if (entry) {
      entry.status = 'synced';
      await this._promisify(store.put(entry));
    }
  }

  /**
   * Mark all pending bill entries with the given invoiceNumber as synced.
   * Used by BillGeneration after a successful background server upload.
   * @param {string} invoiceNumber
   */
  async markSyncedByInvoice(invoiceNumber) {
    await this._ready;
    if (!invoiceNumber) return;

    if (this._fallback) {
      this._fallback
        .filter(e => e.type === 'bill' && e.status === 'pending_sync' && e.payload.invoiceNumber === invoiceNumber)
        .forEach(e => { e.status = 'synced'; });
      return;
    }

    return new Promise((resolve, reject) => {
      const store = this._tx('readwrite');
      const index = store.index('status');
      const req = index.getAll('pending_sync');
      req.onsuccess = async () => {
        const matches = (req.result || []).filter(
          e => e.type === 'bill' && e.payload.invoiceNumber === invoiceNumber
        );
        for (const entry of matches) {
          entry.status = 'synced';
          await this._promisify(store.put(entry));
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Mark an entry as failed — increments retryCount, keeps status as pending_sync for retry.
   * After 5 failures, marks as 'failed_permanent' to stop infinite retries.
   * @param {number} id
   */
  async markFailed(id) {
    await this._ready;

    if (this._fallback) {
      const entry = this._fallback.find((e) => e.id === id);
      if (entry) {
        entry.retryCount = (entry.retryCount || 0) + 1;
        if (entry.retryCount >= 5) {
          entry.status = 'failed_permanent';
          console.error(`[offlineQueue] Entry id=${id} failed 5 times — marking permanent failure. Type: ${entry.type}, payload:`, entry.payload);
        } else {
          console.warn(`[offlineQueue] Sync failed for entry id=${id} (attempt ${entry.retryCount}/5); will retry.`);
        }
      }
      return;
    }

    const store = this._tx('readwrite');
    const entry = await this._promisify(store.get(id));
    if (entry) {
      entry.retryCount = (entry.retryCount || 0) + 1;
      if (entry.retryCount >= 5) {
        entry.status = 'failed_permanent';
        console.error(`[offlineQueue] Entry id=${id} failed 5 times — marking permanent failure. Type: ${entry.type}, payload:`, entry.payload);
      } else {
        console.warn(`[offlineQueue] Sync failed for entry id=${id} (attempt ${entry.retryCount}/5); will retry.`);
      }
      await this._promisify(store.put(entry));
    }
  }

  /**
   * Reset all permanently failed entries back to pending_sync for manual retry.
   */
  async resetFailedEntries() {
    await this._ready;

    if (this._fallback) {
      this._fallback
        .filter(e => e.status === 'failed_permanent')
        .forEach(e => { e.status = 'pending_sync'; e.retryCount = 0; });
      return;
    }

    return new Promise((resolve, reject) => {
      const store = this._tx('readwrite');
      const req = store.getAll();
      req.onsuccess = async () => {
        const failed = (req.result || []).filter(e => e.status === 'failed_permanent');
        for (const entry of failed) {
          entry.status = 'pending_sync';
          entry.retryCount = 0;
          await this._promisify(store.put(entry));
        }
        resolve(failed.length);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Returns count of permanently failed entries.
   */
  async countFailed() {
    await this._ready;

    if (this._fallback) {
      return this._fallback.filter(e => e.status === 'failed_permanent').length;
    }

    return new Promise((resolve, reject) => {
      const store = this._tx('readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter(e => e.status === 'failed_permanent').length);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Returns the count of pending_sync + failed_permanent entries.
   * @returns {Promise<number>}
   */
  async countPending() {
    await this._ready;

    if (this._fallback) {
      return this._fallback.filter((e) => e.status === 'pending_sync' || e.status === 'failed_permanent').length;
    }

    return new Promise((resolve, reject) => {
      const store = this._tx('readonly');
      const req = store.getAll();
      req.onsuccess = () => resolve(
        (req.result || []).filter(e => e.status === 'pending_sync' || e.status === 'failed_permanent').length
      );
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete all 'synced' entries from the queue to prevent unbounded growth.
   * Safe to call at any time — only removes already-uploaded entries.
   */
  async purgeSyncedEntries() {
    await this._ready;
    if (this._fallback) {
      const before = this._fallback.length;
      this._fallback = this._fallback.filter(e => e.status !== 'synced');
      console.log(`[offlineQueue] Purged ${before - this._fallback.length} synced entries`);
      return;
    }
    return new Promise((resolve, reject) => {
      const store = this._tx('readwrite');
      const req = store.getAll();
      req.onsuccess = async () => {
        const synced = (req.result || []).filter(e => e.status === 'synced');
        for (const entry of synced) store.delete(entry.id);
        console.log(`[offlineQueue] Purged ${synced.length} synced entries`);
        resolve(synced.length);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Returns true if a PENDING entry with matching type and payload[uniqueKey] === uniqueValue exists.
   * Only checks pending_sync entries — synced entries are ignored.
   */
  async isDuplicate(type, uniqueKey, uniqueValue) {
    await this._ready;

    if (this._fallback) {
      return this._fallback.some(
        (e) => e.status === 'pending_sync' && e.type === type && e.payload[uniqueKey] === uniqueValue
      );
    }

    return new Promise((resolve, reject) => {
      const store = this._tx('readonly');
      const index = store.index('status');
      const req = index.getAll('pending_sync');
      req.onsuccess = () => {
        const found = (req.result || []).some(
          (e) => e.type === type && e.payload[uniqueKey] === uniqueValue
        );
        resolve(found);
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineQueue = new OfflineQueue();
