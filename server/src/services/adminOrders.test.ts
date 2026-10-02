import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { changeOrderStatus, listAdminOrders } from './adminOrders';
import { cancelOrder } from './orders';

const seedDir = loadConfig().seedDir;
let db: Db;

function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

const query = (raw: Record<string, unknown> = {}) => ({ status: null, page: 1, pageSize: 10, ...raw }) as Parameters<typeof listAdminOrders>[1];

/** Stock of every product and variant, so two databases can be compared after the same cancellation. */
function stockSnapshot(database: Db) {
  return {
    products: database.prepare('SELECT id, stock FROM products ORDER BY id').all(),
    variants: database.prepare('SELECT id, stock FROM product_variants ORDER BY id').all(),
  };
}

function orderStatus(id: number): string {
  return (db.prepare('SELECT status FROM orders WHERE id = ?').get(id) as { status: string }).status;
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, seedDir);
});

describe('admin order list', () => {
  it('lists every order newest first in the standard list shape, with the customer', () => {
    const res = listAdminOrders(db, query());
    expect(res).toMatchObject({ page: 1, pageSize: 10, total: 3 });
    expect(res.data.map((o) => o.id)).toEqual([3, 2, 1]);
    expect(res.data[0]).toMatchObject({
      number: 'SL-20260930-0003',
      status: 'Processing',
      itemCount: 5,
      totalCents: 9200,
      customer: { id: 1, name: expect.any(String), email: 'customer1@shoplab.test' },
    });
  });

  it('filters by status and pages past the end with an empty list', () => {
    expect(listAdminOrders(db, query({ status: 'Shipped' })).data.map((o) => o.id)).toEqual([2]);
    expect(listAdminOrders(db, query({ status: 'Cancelled' }))).toMatchObject({ data: [], total: 0 });
    expect(listAdminOrders(db, query({ page: 5 }))).toEqual({ data: [], page: 5, pageSize: 10, total: 3 });
  });

  it('includes orders of every customer', () => {
    db.prepare('UPDATE orders SET user_id = 2 WHERE id = 1').run();
    const emails = listAdminOrders(db, query()).data.map((o) => o.customer.email);
    expect(emails).toContain('customer2@shoplab.test');
    expect(emails).toContain('customer1@shoplab.test');
  });

  it('pages the many-orders scenario without repeating an order', () => {
    seedDatabase(db, seedDir, 'many-orders');
    const seen = new Set<number>();
    const first = listAdminOrders(db, query({ pageSize: 20 }));
    expect(first.total).toBe(50);
    for (let page = 1; page <= 3; page++) {
      for (const o of listAdminOrders(db, query({ pageSize: 20, page })).data) seen.add(o.id);
    }
    expect(seen.size).toBe(50);
  });
});

describe('admin status change', () => {
  it('moves Processing to Shipped to Delivered', () => {
    expect(changeOrderStatus(db, 3, 'Shipped').status).toBe('Shipped');
    expect(changeOrderStatus(db, 3, 'Delivered').status).toBe('Delivered');
    expect(orderStatus(3)).toBe('Delivered');
  });

  it('rejects an unknown or misspelt status with a 400 and an unknown order with a 404', () => {
    for (const bad of ['shipped', 'Returned', 7, undefined, null]) {
      const err = failure(() => changeOrderStatus(db, 3, bad));
      expect(err.status).toBe(400);
      expect(err.fieldErrors?.status).toBeDefined();
    }
    expect(failure(() => changeOrderStatus(db, 999, 'Shipped')).status).toBe(404);
    expect(orderStatus(3)).toBe('Processing');
  });

  it('answers 409 for a move that is not allowed and changes nothing', () => {
    for (const [id, to] of [
      [3, 'Delivered'], // skips Shipped
      [3, 'Processing'], // same status
      [2, 'Processing'], // backwards
      [1, 'Shipped'], // Delivered is final
      [1, 'Cancelled'],
    ] as const) {
      const before = orderStatus(id);
      expect(failure(() => changeOrderStatus(db, id, to)).status, `${id} -> ${to}`).toBe(409);
      expect(orderStatus(id)).toBe(before);
    }
  });

  it('gives the stock back on Cancelled, exactly as the customer cancel does', () => {
    const viaAdmin = stockSnapshot(db);
    changeOrderStatus(db, 3, 'Cancelled');
    const afterAdmin = stockSnapshot(db);

    const other = openDatabase(':memory:');
    seedDatabase(other, seedDir);
    cancelOrder(other, 1, 3);
    expect(afterAdmin).toEqual(stockSnapshot(other));

    expect(afterAdmin).not.toEqual(viaAdmin);
    expect(orderStatus(3)).toBe('Cancelled');
    other.close();
  });

  it('gives the stock back when a Shipped order is cancelled', () => {
    const before = stockSnapshot(db);
    changeOrderStatus(db, 2, 'Cancelled');
    expect(stockSnapshot(db)).not.toEqual(before);
    expect(orderStatus(2)).toBe('Cancelled');
  });

  it('refuses any change to a Cancelled order and does not return the stock twice', () => {
    changeOrderStatus(db, 3, 'Cancelled');
    const after = stockSnapshot(db);
    for (const to of ['Processing', 'Shipped', 'Delivered', 'Cancelled']) {
      expect(failure(() => changeOrderStatus(db, 3, to)).status).toBe(409);
    }
    expect(stockSnapshot(db)).toEqual(after);
  });

  it('shows the new status to the customer through the normal order history', () => {
    changeOrderStatus(db, 3, 'Shipped');
    expect((db.prepare('SELECT status FROM orders WHERE id = 3 AND user_id = 1').get() as { status: string }).status).toBe('Shipped');
    // The customer can no longer cancel it.
    expect(failure(() => cancelOrder(db, 1, 3)).status).toBe(409);
  });
});
