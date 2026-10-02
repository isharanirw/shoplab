export type WishlistOrderCheck = { ok: true; productIds: number[] } | { ok: false; message: string };

/**
 * Checks a submitted wishlist order against the products the user has saved. It must be an array of
 * positive whole numbers with no repeats that contains exactly the saved products (nothing missing, nothing extra).
 */
export function checkWishlistOrder(saved: readonly number[], submitted: unknown): WishlistOrderCheck {
  if (!Array.isArray(submitted)) return { ok: false, message: 'productIds must be an array of product IDs.' };
  if (!submitted.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 1)) {
    return { ok: false, message: 'productIds must contain only positive whole numbers.' };
  }
  const ids = submitted as number[];
  if (new Set(ids).size !== ids.length) return { ok: false, message: 'productIds must not contain the same product twice.' };
  const savedSet = new Set(saved);
  const missing = saved.filter((id) => !ids.includes(id));
  const unexpected = ids.filter((id) => !savedSet.has(id));
  if (missing.length > 0 || unexpected.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
    if (unexpected.length > 0) parts.push(`not on your wishlist: ${unexpected.join(', ')}`);
    return { ok: false, message: `productIds must list exactly the products on your wishlist (${parts.join('; ')}).` };
  }
  return { ok: true, productIds: ids };
}
