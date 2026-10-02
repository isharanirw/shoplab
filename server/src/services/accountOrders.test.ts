import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { parseOrderListQuery } from '../lib/orderQuery';
import { addItem } from './cart';
import { cancelOrder, getOrderForUser, listOrdersForUser, placeOrder } from './orders';

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

const list = (raw: Record<string, unknown>, userId = 1) => listOrdersForUser(db, userId, parseOrderListQuery(raw));
const stockOf = (id: number) => (db.prepare('SELECT stock FROM products WHERE id = ?').get(id) as { stock: number }).stock;
const variantStock = (id: number) => (db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(id) as { stock: number }).stock;

describe('order history (default seed: 3 orders for customer1)', () => {
  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db, seedDir);
  });

  it('lists own orders newest first in the standard list shape', () => {
    const res = list({});
    expect(res).toMatchObject({ page: 1, pageSize: 5, total: 3 });
    expect(res.data.map((o) => o.number)).toEqual(['SL-20260930-0003', 'SL-20260918-0002', 'SL-20260812-0001']);
    expect(res.data[0]).toMatchObject({ status: 'Processing', itemCount: 5, totalCents: 9200 });
  });

  it('sorts by total in both directions and by date ascending', () => {
    expect(list({ sort: 'total_desc' }).data.map((o) => o.totalCents)).toEqual([23463, 9629, 9200]);
    expect(list({ sort: 'total_asc' }).data.map((o) => o.totalCents)).toEqual([9200, 9629, 23463]);
    expect(list({ sort: 'date_asc' }).data.map((o) => o.number)[0]).toBe('SL-20260812-0001');
  });

  it('filters by status', () => {
    expect(list({ status: 'Shipped' }).data.map((o) => o.id)).toEqual([2]);
    expect(list({ status: 'Cancelled' })).toMatchObject({ data: [], total: 0 });
  });

  it('returns nothing for a user without orders and never mixes in other users', () => {
    expect(list({}, 2)).toEqual({ data: [], page: 1, pageSize: 5, total: 0 });
  });
});

describe('order history paging (many-orders scenario)', () => {
  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db, seedDir, 'many-orders');
  });

  it('pages 5 at a time with the full total and does not repeat orders across pages', () => {
    const first = list({});
    expect(first.total).toBeGreaterThan(10);
    expect(first.data).toHaveLength(5);
    const seen = new Set<number>();
    const pages = Math.ceil(first.total / 5);
    for (let page = 1; page <= pages; page++) {
      const res = list({ page: String(page) });
      expect(res.page).toBe(page);
      expect(res.data.length).toBe(page < pages ? 5 : first.total - 5 * (pages - 1));
      for (const o of res.data) {
        expect(seen.has(o.id)).toBe(false);
        seen.add(o.id);
      }
    }
    expect(seen.size).toBe(first.total);
  });

  it('keeps the sort across pages and an out-of-range page is an empty list', () => {
    const all = Array.from({ length: Math.ceil(list({}).total / 5) }, (_, i) => list({ sort: 'total_asc', page: String(i + 1) }).data).flat();
    const totals = all.map((o) => o.totalCents);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(list({ page: '999' })).toMatchObject({ data: [], page: 999 });
  });

  it('applies the status filter before paging', () => {
    const res = list({ status: 'Delivered' });
    expect(res.data.every((o) => o.status === 'Delivered')).toBe(true);
    expect(res.total).toBe((db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = 1 AND status = 'Delivered'").get() as { n: number }).n);
  });
});

describe('cancelOrder', () => {
  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db, seedDir);
  });

  it('cancels a Processing order and gives the stock back', () => {
    const before = [41, 40, 56].map(stockOf);
    const order = cancelOrder(db, 1, 3);
    expect(order.status).toBe('Cancelled');
    expect([41, 40, 56].map(stockOf)).toEqual([before[0]! + 1, before[1]! + 3, before[2]! + 1]);
    expect(getOrderForUser(db, 1, 3)?.status).toBe('Cancelled');
  });

  it('only allows Processing orders: Shipped and Delivered and already Cancelled give 409', () => {
    for (const id of [1, 2]) {
      const err = failure(() => cancelOrder(db, 1, id));
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONFLICT');
    }
    cancelOrder(db, 1, 3);
    expect(failure(() => cancelOrder(db, 1, 3)).status).toBe(409);
  });

  it('does not change stock when the cancel is refused', () => {
    const before = stockOf(1);
    failure(() => cancelOrder(db, 1, 2));
    expect(stockOf(1)).toBe(before);
  });

  it('treats another user\'s order and an unknown order as not found', () => {
    expect(failure(() => cancelOrder(db, 2, 3)).status).toBe(404);
    expect(failure(() => cancelOrder(db, 1, 9999)).status).toBe(404);
    expect(getOrderForUser(db, 1, 3)?.status).toBe('Processing');
  });

  it('restores variant stock as well as product stock for a variant line', () => {
    const date = '2026-10-05';
    addItem(db, 2, { productId: 11, variantId: 6, quantity: 2 });
    const productBefore = stockOf(11);
    const variantBefore = variantStock(6);
    const { order } = placeOrder(
      db,
      2,
      {
        shippingMethod: 'standard',
        deliveryDate: date,
        address: {
          firstName: 'Sam',
          lastName: 'Tester',
          street: 'Storgatan 1',
          countryCode: 'SE',
          regionCode: 'AB',
          postalCode: '11157',
          phone: '+46 8 123 456',
        },
        paymentToken: 'tok_ok_4242',
        acceptTerms: true,
      },
      new Date('2026-10-02T10:00:00.000Z'),
    );
    expect(stockOf(11)).toBe(productBefore - 2);
    expect(variantStock(6)).toBe(variantBefore - 2);
    cancelOrder(db, 2, order.id);
    expect(stockOf(11)).toBe(productBefore);
    expect(variantStock(6)).toBe(variantBefore);
  });
});
