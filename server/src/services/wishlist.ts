import type { Db } from '../db/connection';
import { SUMMARY_COLUMNS, SUMMARY_FROM, mapSummary } from './catalogue';
import type { ListResult, ProductSummary, SummaryRow } from './catalogue';

export interface WishlistItem extends ProductSummary {
  position: number;
  addedAt: string;
}

/** Everything the user has saved, in wishlist order. The list is not paged: pageSize equals the item count. */
export function listWishlist(db: Db, userId: number): ListResult<WishlistItem> {
  const rows = db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS}, w.position AS position, w.added_at AS added_at
       ${SUMMARY_FROM}
       JOIN wishlist_items w ON w.product_id = p.id
       WHERE w.user_id = ? AND p.active = 1
       ORDER BY w.position ASC, w.product_id ASC`,
    )
    .all(userId) as (SummaryRow & { position: number; added_at: string })[];
  const data = rows.map((row) => ({ ...mapSummary(row), position: row.position, addedAt: row.added_at }));
  return { data, page: 1, pageSize: data.length, total: data.length };
}

export type AddResult = 'added' | 'exists' | 'no-product';

/** Appends a product to the end of the list. Adding a product that is already saved changes nothing. */
export function addToWishlist(db: Db, userId: number, productId: number, now: Date = new Date()): AddResult {
  const product = db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(productId);
  if (!product) return 'no-product';
  const existing = db.prepare('SELECT 1 FROM wishlist_items WHERE user_id = ? AND product_id = ?').get(userId, productId);
  if (existing) return 'exists';
  const { next } = db
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM wishlist_items WHERE user_id = ?')
    .get(userId) as { next: number };
  db.prepare('INSERT INTO wishlist_items (user_id, product_id, position, added_at) VALUES (?, ?, ?, ?)').run(
    userId,
    productId,
    next,
    now.toISOString(),
  );
  return 'added';
}

/** Returns false when the product was not on the user's wishlist. */
export function removeFromWishlist(db: Db, userId: number, productId: number): boolean {
  const info = db.prepare('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?').run(userId, productId);
  if (info.changes === 0) return false;
  // Close the gap so positions stay 1..n.
  const rows = db
    .prepare('SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY position, product_id')
    .all(userId) as { product_id: number }[];
  const update = db.prepare('UPDATE wishlist_items SET position = ? WHERE user_id = ? AND product_id = ?');
  rows.forEach((row, index) => update.run(index + 1, userId, row.product_id));
  return true;
}
