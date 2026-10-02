import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { addToWishlist, listWishlist, reorderWishlist } from './wishlist';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, loadConfig().seedDir);
});

function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

describe('reorderWishlist', () => {
  it('saves the new order and returns the list in that order with positions 1..n', () => {
    // customer1 starts with products 36 then 21.
    const res = reorderWishlist(db, 1, [21, 36]);
    expect(res.data.map((i) => [i.id, i.position])).toEqual([[21, 1], [36, 2]]);
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([21, 36]);
  });

  it('puts later additions after the reordered items', () => {
    addToWishlist(db, 1, 5);
    reorderWishlist(db, 1, [5, 21, 36]);
    addToWishlist(db, 1, 9);
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([5, 21, 36, 9]);
  });

  it('rejects an order with a missing item, a foreign item, a duplicate or the wrong type, and changes nothing', () => {
    for (const bad of [[36], [36, 21, 5], [36, 36], '36,21', [36, '21'], undefined, []]) {
      const err = failure(() => reorderWishlist(db, 1, bad));
      expect(err.status).toBe(400);
      expect(err.fieldErrors).toHaveProperty('productIds');
    }
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([36, 21]);
  });

  it('does not let one user reorder with another user\'s items', () => {
    addToWishlist(db, 2, 3);
    expect(failure(() => reorderWishlist(db, 2, [3, 36])).status).toBe(400);
    expect(failure(() => reorderWishlist(db, 2, [36, 21])).status).toBe(400);
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([36, 21]);
  });

  it('accepts an empty list for an empty wishlist', () => {
    expect(reorderWishlist(db, 2, [])).toMatchObject({ data: [], total: 0 });
  });

  it('keeps saved products that are no longer sold after the visible ones', () => {
    db.prepare('UPDATE products SET active = 0 WHERE id = 36').run();
    reorderWishlist(db, 1, [21]);
    const positions = db.prepare('SELECT product_id, position FROM wishlist_items WHERE user_id = 1 ORDER BY position').all();
    expect(positions).toEqual([
      { product_id: 21, position: 1 },
      { product_id: 36, position: 2 },
    ]);
  });
});
