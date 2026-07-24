/**
 * Tests for offlineQueue.js
 *
 * Uses fake-indexeddb to provide a real IDB implementation in Node.js.
 * Uses fast-check for property-based tests.
 *
 * Sub-tasks covered:
 *   1.1 — Property 3: Enqueue stores payload with pending_sync status
 *   1.2 — Property 6: Invalid payloads are rejected by the queue
 *   1.3 — Property 7: Bill deduplication by invoiceNumber
 *   1.4 — Property 1: Offline queue persistence across reloads
 *   1.5 — Unit tests for offlineQueue.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { IDBFactory } from 'fake-indexeddb';
import { OfflineQueue } from '../offlineQueue.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a fresh OfflineQueue instance backed by a brand-new fake IDB factory.
 * This simulates a "fresh page load" with no prior data.
 */
async function makeQueue(existingFactory) {
  const factory = existingFactory ?? new IDBFactory();
  const q = new OfflineQueue(factory);
  await q._ready;
  return { q, factory };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const nonEmptyString = fc.string({ minLength: 1, maxLength: 40 });

const itemArb = fc.record({
  menuItemId: nonEmptyString,
  name: nonEmptyString,
  quantity: fc.integer({ min: 1, max: 20 }),
  price: fc.float({ min: 1, max: 1000, noNaN: true }),
});

const kotPayloadArb = fc.record({
  branchId: nonEmptyString,
  kotNumber: nonEmptyString,
  items: fc.array(itemArb, { minLength: 1, maxLength: 5 }),
  tableNumber: fc.option(nonEmptyString, { nil: null }),
  totalAmount: fc.float({ min: 0, max: 10000, noNaN: true }),
});

const billPayloadArb = fc.record({
  invoiceNumber: nonEmptyString,
  existingOrderIds: fc.array(nonEmptyString, { minLength: 1, maxLength: 5 }),
  branchId: nonEmptyString,
  totalAmount: fc.float({ min: 0, max: 10000, noNaN: true }),
});

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('offlineQueue — unit tests (1.5)', () => {
  let q;

  beforeEach(async () => {
    ({ q } = await makeQueue());
  });

  it('enqueues a KOT and returns entry with pending_sync status', async () => {
    const payload = { branchId: 'B1', kotNumber: 'KOT-001', items: [{ menuItemId: 'm1', name: 'Tea', quantity: 1, price: 20 }] };
    const entry = await q.enqueue('kot', payload);
    expect(entry.status).toBe('pending_sync');
    expect(entry.id).toBeDefined();
    expect(entry.type).toBe('kot');
    expect(entry.payload).toEqual(payload);
    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('enqueues a bill and returns entry with pending_sync status', async () => {
    const payload = { invoiceNumber: 'INV-001', existingOrderIds: ['o1', 'o2'], branchId: 'B1' };
    const entry = await q.enqueue('bill', payload);
    expect(entry.status).toBe('pending_sync');
    expect(entry.type).toBe('bill');
  });

  it('rejects KOT missing items', async () => {
    await expect(q.enqueue('kot', { branchId: 'B1', kotNumber: 'KOT-001' })).rejects.toThrow(/items/);
  });

  it('rejects KOT missing branchId', async () => {
    await expect(q.enqueue('kot', { kotNumber: 'KOT-001', items: [] })).rejects.toThrow(/branchId/);
  });

  it('rejects KOT missing kotNumber', async () => {
    await expect(q.enqueue('kot', { branchId: 'B1', items: [] })).rejects.toThrow(/kotNumber/);
  });

  it('rejects bill missing invoiceNumber', async () => {
    await expect(q.enqueue('bill', { existingOrderIds: ['o1'] })).rejects.toThrow(/invoiceNumber/);
  });

  it('rejects bill missing existingOrderIds', async () => {
    await expect(q.enqueue('bill', { invoiceNumber: 'INV-001' })).rejects.toThrow(/existingOrderIds/);
  });

  it('rejects unknown type', async () => {
    await expect(q.enqueue('unknown', {})).rejects.toThrow(/Unknown entry type/);
  });

  it('listPending returns only pending_sync entries ordered by createdAt', async () => {
    const p1 = { branchId: 'B1', kotNumber: 'KOT-001', items: [{ menuItemId: 'm1', name: 'Tea', quantity: 1, price: 10 }] };
    const p2 = { branchId: 'B1', kotNumber: 'KOT-002', items: [{ menuItemId: 'm2', name: 'Coffee', quantity: 1, price: 15 }] };
    const e1 = await q.enqueue('kot', p1);
    const e2 = await q.enqueue('kot', p2);
    await q.markSynced(e1.id);
    const pending = await q.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(e2.id);
  });

  it('markSynced sets status to synced', async () => {
    const entry = await q.enqueue('kot', { branchId: 'B1', kotNumber: 'KOT-001', items: [{ menuItemId: 'm1', name: 'Tea', quantity: 1, price: 10 }] });
    await q.markSynced(entry.id);
    const pending = await q.listPending();
    expect(pending.find((e) => e.id === entry.id)).toBeUndefined();
  });

  it('countPending returns correct count', async () => {
    expect(await q.countPending()).toBe(0);
    await q.enqueue('kot', { branchId: 'B1', kotNumber: 'KOT-001', items: [{ menuItemId: 'm1', name: 'Tea', quantity: 1, price: 10 }] });
    expect(await q.countPending()).toBe(1);
    await q.enqueue('kot', { branchId: 'B1', kotNumber: 'KOT-002', items: [{ menuItemId: 'm2', name: 'Coffee', quantity: 1, price: 15 }] });
    expect(await q.countPending()).toBe(2);
  });

  it('isDuplicate returns true for matching type+key+value', async () => {
    await q.enqueue('bill', { invoiceNumber: 'INV-42', existingOrderIds: ['o1'] });
    expect(await q.isDuplicate('bill', 'invoiceNumber', 'INV-42')).toBe(true);
  });

  it('isDuplicate returns false when no match', async () => {
    await q.enqueue('bill', { invoiceNumber: 'INV-42', existingOrderIds: ['o1'] });
    expect(await q.isDuplicate('bill', 'invoiceNumber', 'INV-99')).toBe(false);
  });

  it('markFailed keeps entry as pending_sync', async () => {
    const entry = await q.enqueue('kot', { branchId: 'B1', kotNumber: 'KOT-001', items: [{ menuItemId: 'm1', name: 'Tea', quantity: 1, price: 10 }] });
    await q.markFailed(entry.id);
    expect(await q.countPending()).toBe(1);
  });
});

// ─── Property Tests ───────────────────────────────────────────────────────────

// Feature: counter-offline-support, Property 3: Enqueue stores payload with pending_sync status
// Validates: Requirements 2.1, 3.1
describe('Property 3 — enqueue stores payload with pending_sync status (1.1)', () => {
  it('holds for arbitrary KOT payloads', async () => {
    await fc.assert(
      fc.asyncProperty(kotPayloadArb, async (payload) => {
        const { q } = await makeQueue();
        const entry = await q.enqueue('kot', payload);
        expect(entry.status).toBe('pending_sync');
        const pending = await q.listPending();
        const found = pending.find((e) => e.id === entry.id);
        expect(found).toBeDefined();
        expect(found.payload).toEqual(payload);
      }),
      { numRuns: 100 }
    );
  });

  it('holds for arbitrary bill payloads', async () => {
    await fc.assert(
      fc.asyncProperty(billPayloadArb, async (payload) => {
        const { q } = await makeQueue();
        const entry = await q.enqueue('bill', payload);
        expect(entry.status).toBe('pending_sync');
        const pending = await q.listPending();
        const found = pending.find((e) => e.id === entry.id);
        expect(found).toBeDefined();
        expect(found.payload).toEqual(payload);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: counter-offline-support, Property 6: Invalid payloads are rejected by the queue
// Validates: Requirements 2.5
describe('Property 6 — invalid payloads are rejected by the queue (1.2)', () => {
  it('KOT with any required field missing is rejected and countPending unchanged', async () => {
    const requiredKotFields = ['items', 'branchId', 'kotNumber'];
    await fc.assert(
      fc.asyncProperty(
        kotPayloadArb,
        fc.constantFrom(...requiredKotFields),
        async (payload, fieldToRemove) => {
          const { q } = await makeQueue();
          const invalidPayload = { ...payload };
          delete invalidPayload[fieldToRemove];
          const before = await q.countPending();
          await expect(q.enqueue('kot', invalidPayload)).rejects.toThrow();
          expect(await q.countPending()).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('bill with any required field missing is rejected and countPending unchanged', async () => {
    const requiredBillFields = ['invoiceNumber', 'existingOrderIds'];
    await fc.assert(
      fc.asyncProperty(
        billPayloadArb,
        fc.constantFrom(...requiredBillFields),
        async (payload, fieldToRemove) => {
          const { q } = await makeQueue();
          const invalidPayload = { ...payload };
          delete invalidPayload[fieldToRemove];
          const before = await q.countPending();
          await expect(q.enqueue('bill', invalidPayload)).rejects.toThrow();
          expect(await q.countPending()).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: counter-offline-support, Property 7: Bill deduplication by invoiceNumber
// Validates: Requirements 3.5
describe('Property 7 — bill deduplication by invoiceNumber (1.3)', () => {
  it('enqueuing the same bill twice does not increase countPending', async () => {
    await fc.assert(
      fc.asyncProperty(billPayloadArb, async (payload) => {
        const { q } = await makeQueue();
        await q.enqueue('bill', payload);
        const countAfterFirst = await q.countPending();

        // Simulate the duplicate-check logic (as BillGeneration.jsx will do)
        const isDup = await q.isDuplicate('bill', 'invoiceNumber', payload.invoiceNumber);
        if (!isDup) {
          await q.enqueue('bill', payload);
        }

        expect(await q.countPending()).toBe(countAfterFirst);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: counter-offline-support, Property 1: Offline queue persistence across reloads
// Validates: Requirements 1.1
describe('Property 1 — offline queue persistence across reloads (1.4)', () => {
  it('entry survives a simulated reload (same IDB factory, new queue instance)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          kotPayloadArb.map((p) => ({ type: 'kot', payload: p })),
          billPayloadArb.map((p) => ({ type: 'bill', payload: p }))
        ),
        async ({ type, payload }) => {
          // First "session" — enqueue
          const factory = new IDBFactory();
          const { q: q1 } = await makeQueue(factory);
          const entry = await q1.enqueue(type, payload);

          // Second "session" — same factory (same DB data), new queue instance
          const q2 = new OfflineQueue(factory);
          await q2._ready;

          const pending = await q2.listPending();
          const found = pending.find((e) => e.id === entry.id);
          expect(found).toBeDefined();
          expect(found.status).toBe('pending_sync');
          expect(found.payload).toEqual(payload);
        }
      ),
      { numRuns: 50 }
    );
  });
});
