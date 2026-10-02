import { describe, expect, it } from 'vitest';
import { checkWishlistOrder } from './wishlistOrder';

describe('checkWishlistOrder', () => {
  it('accepts any permutation of exactly the saved products', () => {
    expect(checkWishlistOrder([1, 2, 3], [3, 1, 2])).toEqual({ ok: true, productIds: [3, 1, 2] });
    expect(checkWishlistOrder([], [])).toEqual({ ok: true, productIds: [] });
  });

  it('rejects a missing product and names it', () => {
    const r = checkWishlistOrder([1, 2, 3], [1, 2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('missing: 3');
  });

  it('rejects a product that is not on the wishlist and names it', () => {
    const r = checkWishlistOrder([1, 2], [1, 2, 9]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('not on your wishlist: 9');
  });

  it('rejects duplicates and wrong types', () => {
    expect(checkWishlistOrder([1, 2], [1, 1]).ok).toBe(false);
    expect(checkWishlistOrder([1, 2], '1,2').ok).toBe(false);
    expect(checkWishlistOrder([1, 2], [1, '2']).ok).toBe(false);
    expect(checkWishlistOrder([1, 2], [1, 2.5]).ok).toBe(false);
    expect(checkWishlistOrder([1], [0]).ok).toBe(false);
    expect(checkWishlistOrder([1], undefined).ok).toBe(false);
  });
});
