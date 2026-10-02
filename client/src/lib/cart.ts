export interface CartLine {
  productId: number;
  variantId: number | null;
  quantity: number;
}

/**
 * STUB. The cart does not exist until Phase 3, so this does nothing and stores nothing.
 * Every "Add to cart" button calls it after applying the real enabled/disabled rules, so the
 * Phase 3 change is only to replace this body with a call to POST /api/cart/items.
 */
export function addToCart(line: CartLine): Promise<void> {
  void line;
  return Promise.resolve();
}

export const CART_STUB_MESSAGE = 'The cart is not available yet, so nothing was added.';
