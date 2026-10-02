import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { addToWishlist, listWishlist, removeFromWishlist } from './wishlist';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, loadConfig().seedDir);
});

describe('wishlist', () => {
  it('lists the seeded items in order with product details', () => {
    const res = listWishlist(db, 1);
    expect(res.data.map((i) => i.id)).toEqual([36, 21]);
    expect(res.data.map((i) => i.position)).toEqual([1, 2]);
    expect(res).toMatchObject({ page: 1, pageSize: 2, total: 2 });
    expect(res.data[0].name).toBeTruthy();
  });

  it('is empty for a user with no items', () => {
    expect(listWishlist(db, 2)).toEqual({ data: [], page: 1, pageSize: 0, total: 0 });
  });

  it('appends new items at the end and ignores a repeated add', () => {
    expect(addToWishlist(db, 2, 5)).toBe('added');
    expect(addToWishlist(db, 2, 9)).toBe('added');
    expect(addToWishlist(db, 2, 5)).toBe('exists');
    expect(listWishlist(db, 2).data.map((i) => [i.id, i.position])).toEqual([[5, 1], [9, 2]]);
  });

  it('rejects an unknown product', () => {
    expect(addToWishlist(db, 2, 999)).toBe('no-product');
  });

  it('removes an item and closes the position gap', () => {
    expect(removeFromWishlist(db, 1, 36)).toBe(true);
    expect(listWishlist(db, 1).data.map((i) => [i.id, i.position])).toEqual([[21, 1]]);
    expect(removeFromWishlist(db, 1, 36)).toBe(false);
  });

  it('keeps each user separate', () => {
    addToWishlist(db, 2, 3);
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([36, 21]);
    expect(listWishlist(db, 2).data.map((i) => i.id)).toEqual([3]);
  });
});
