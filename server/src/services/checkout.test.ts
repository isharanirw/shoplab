import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { addItem, applyCoupon, clearCart, getCart, mergeGuestCart, removeCoupon, removeItem, setItemQuantity } from './cart';
import { getOrderForUser, placeOrder } from './orders';
import { quoteCheckout } from './quote';

const NOW = new Date('2026-10-02T10:00:00.000Z'); // a Friday
const MONDAY = '2026-10-05';
const seedDir = loadConfig().seedDir;
let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, seedDir);
});

/** Runs a call that should fail with an ApiError and returns the error. */
function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

const stockOf = (id: number) => (db.prepare('SELECT stock FROM products WHERE id = ?').get(id) as { stock: number }).stock;
const variantStock = (id: number) => (db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(id) as { stock: number }).stock;

function orderBody(overrides: Record<string, unknown> = {}) {
  return { shippingMethod: 'standard', deliveryDate: MONDAY, addressId: 1, paymentToken: 'tok_ok_4242', acceptTerms: true, ...overrides };
}

describe('cart lines', () => {
  it('merges the same product and variant into one line', () => {
    expect(addItem(db, 2, { productId: 3, quantity: 2 }).created).toBe(true);
    expect(addItem(db, 2, { productId: 3, quantity: 3 }).created).toBe(false);
    const cart = getCart(db, 2, NOW);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ productId: 3, quantity: 5, lineTotalCents: 14500 });
    expect(cart.itemCount).toBe(5);
  });

  it('keeps variants of one product as separate lines and requires a variant', () => {
    addItem(db, 2, { productId: 9, variantId: 1, quantity: 1 });
    addItem(db, 2, { productId: 9, variantId: 2, quantity: 1 });
    expect(getCart(db, 2, NOW).items.map((i) => i.variantLabel)).toEqual(['Black', 'Blue']);
    expect(failure(() => addItem(db, 2, { productId: 9, quantity: 1 })).status).toBe(400);
    expect(failure(() => addItem(db, 2, { productId: 3, variantId: 1, quantity: 1 })).status).toBe(400);
    expect(failure(() => addItem(db, 2, { productId: 6, variantId: 1, quantity: 1 })).status).toBe(400);
  });

  it('uses the sale price when a product is on sale', () => {
    addItem(db, 2, { productId: 2, quantity: 2 });
    const item = getCart(db, 2, NOW).items[0]!;
    expect(item).toMatchObject({ unitPriceCents: 3999, regularPriceCents: 4999, onSale: true, lineTotalCents: 7998 });
  });

  it('rejects quantities outside 1 to 10 with 400 and unknown products with 404', () => {
    for (const quantity of [0, 11, -2, 1.5, '2']) {
      expect(failure(() => addItem(db, 2, { productId: 3, quantity })).status).toBe(400);
    }
    expect(failure(() => addItem(db, 2, { productId: 999, quantity: 1 })).status).toBe(404);
  });

  it('answers 409 when the stock cannot cover the quantity, including what is already in the cart', () => {
    expect(failure(() => addItem(db, 2, { productId: 5, quantity: 3 })).status).toBe(409); // stock 2
    expect(failure(() => addItem(db, 2, { productId: 7, quantity: 1 })).message).toBe('This item is out of stock.');
    expect(failure(() => addItem(db, 2, { productId: 9, variantId: 3, quantity: 1 })).status).toBe(409); // variant at 0
    addItem(db, 2, { productId: 5, quantity: 2 });
    expect(failure(() => addItem(db, 2, { productId: 5, quantity: 1 })).message).toContain('You already have 2');
  });

  it('caps a line at 10 even when the stock is higher', () => {
    addItem(db, 2, { productId: 3, quantity: 8 });
    const err = failure(() => addItem(db, 2, { productId: 3, quantity: 3 }));
    expect(err.status).toBe(409);
    expect(err.message).toContain('at most 10');
  });

  it('changes and removes lines, only for their owner', () => {
    addItem(db, 2, { productId: 3, quantity: 1 });
    const id = getCart(db, 2, NOW).items[0]!.id;
    setItemQuantity(db, 2, id, 4);
    expect(getCart(db, 2, NOW).items[0]!.quantity).toBe(4);
    expect(failure(() => setItemQuantity(db, 2, id, 11)).status).toBe(400);
    expect(failure(() => setItemQuantity(db, 1, id, 2)).status).toBe(404);
    expect(failure(() => removeItem(db, 1, id)).status).toBe(404);
    removeItem(db, 2, id);
    expect(getCart(db, 2, NOW).items).toEqual([]);
  });

  it('clears the cart and its coupon', () => {
    addItem(db, 2, { productId: 3, quantity: 2 });
    applyCoupon(db, 2, 'SAVE10', NOW);
    clearCart(db, 2);
    expect(getCart(db, 2, NOW)).toMatchObject({ items: [], coupon: null, itemCount: 0 });
  });

  it('keeps every user cart separate and starts empty', () => {
    addItem(db, 1, { productId: 3, quantity: 1 });
    expect(getCart(db, 2, NOW).items).toEqual([]);
    expect(getCart(db, 1, NOW).items).toHaveLength(1);
  });
});

describe('coupons in the cart', () => {
  beforeEach(() => {
    addItem(db, 2, { productId: 3, quantity: 4 }); // $116.00
  });

  it('applies SAVE10 and shows the discount in the totals', () => {
    applyCoupon(db, 2, 'save10', NOW);
    const cart = getCart(db, 2, NOW);
    expect(cart.coupon).toMatchObject({ code: 'SAVE10', applied: true });
    expect(cart.totals).toMatchObject({ subtotalCents: 11600, discountCents: 1160, shippingCents: 0, taxCents: 1044, totalCents: 11484 });
  });

  it('allows only one coupon at a time', () => {
    applyCoupon(db, 2, 'SAVE10', NOW);
    const err = failure(() => applyCoupon(db, 2, 'MIN100', NOW));
    expect(err.status).toBe(409);
    removeCoupon(db, 2);
    applyCoupon(db, 2, 'MIN100', NOW);
    expect(getCart(db, 2, NOW).coupon?.code).toBe('MIN100');
  });

  it('rejects unknown, expired and below-minimum coupons', () => {
    expect(failure(() => applyCoupon(db, 2, 'NOPE', NOW)).fieldErrors?.code).toBe('That coupon code is not valid.');
    expect(failure(() => applyCoupon(db, 2, 'EXPIRED20', NOW)).fieldErrors?.code).toBe('EXPIRED20 has expired.');
    expect(failure(() => applyCoupon(db, 2, '', NOW)).status).toBe(400);
    clearCart(db, 2);
    addItem(db, 2, { productId: 6, quantity: 1 }); // $24.99
    expect(failure(() => applyCoupon(db, 2, 'FREESHIP', NOW)).fieldErrors?.code).toBe('FREESHIP needs a subtotal of $30.00 or more.');
    expect(failure(() => applyCoupon(db, 2, 'MIN100', NOW)).status).toBe(400);
  });

  it('keeps an applied coupon but stops discounting when the cart drops below its minimum', () => {
    applyCoupon(db, 2, 'MIN100', NOW);
    expect(getCart(db, 2, NOW).totals.discountCents).toBe(2000);
    const id = getCart(db, 2, NOW).items[0]!.id;
    setItemQuantity(db, 2, id, 3); // $87.00
    const cart = getCart(db, 2, NOW);
    expect(cart.coupon).toMatchObject({ code: 'MIN100', applied: false, reason: 'below_minimum' });
    expect(cart.totals.discountCents).toBe(0);
    setItemQuantity(db, 2, id, 4);
    expect(getCart(db, 2, NOW).coupon?.applied).toBe(true);
  });

  it('shows FREESHIP as a $0.00 discount with free Standard shipping', () => {
    clearCart(db, 2);
    addItem(db, 2, { productId: 3, quantity: 1 }); // $29.00 is below $30
    expect(failure(() => applyCoupon(db, 2, 'FREESHIP', NOW)).status).toBe(400);
    addItem(db, 2, { productId: 6, quantity: 1 }); // $53.99
    applyCoupon(db, 2, 'FREESHIP', NOW);
    expect(getCart(db, 2, NOW).totals).toMatchObject({ discountCents: 0, shippingCents: 0 });
  });
});

describe('guest cart merge', () => {
  it('adds the guest lines to the server cart, capping and reporting', () => {
    addItem(db, 2, { productId: 3, quantity: 8 });
    const report = mergeGuestCart(
      db,
      2,
      [
        { productId: 3, quantity: 5 },
        { productId: 5, quantity: 3 },
        { productId: 7, quantity: 1 },
        { productId: 6, quantity: 2 },
      ],
      NOW,
    );
    const lines = getCart(db, 2, NOW).items.map((i) => [i.productId, i.quantity]);
    expect(lines).toEqual([[3, 10], [5, 2], [6, 2]]);
    expect(report.map((r) => [r.productId, r.reason, r.resulting])).toEqual([[3, 'capped', 10], [5, 'capped', 2], [7, 'out_of_stock', 0]]);
    expect(report[0]!.name).toBeTruthy();
  });

  it('rejects a malformed guest cart with 400', () => {
    expect(failure(() => mergeGuestCart(db, 2, 'nope')).status).toBe(400);
    expect(failure(() => mergeGuestCart(db, 2, [{ productId: 3, quantity: 99 }])).fieldErrors).toHaveProperty(['items.0']);
  });
});

describe('placing an order', () => {
  it('creates the order, decrements stock, clears the cart and reports totals', () => {
    addItem(db, 1, { productId: 15, quantity: 2 }); // $12.25 sale
    addItem(db, 1, { productId: 23, quantity: 3 }); // $27.00
    applyCoupon(db, 1, 'SAVE10', NOW);
    const stockBefore = { p15: stockOf(15), p23: stockOf(23) };

    const { order } = placeOrder(db, 1, orderBody(), NOW);

    expect(order).toMatchObject({
      number: 'SL-20261002-0001',
      status: 'Processing',
      couponCode: 'SAVE10',
      subtotalCents: 10550,
      discountCents: 1055,
      shippingCents: 500,
      taxCents: 950,
      totalCents: 10945,
      paymentLast4: '4242',
      deliveryDate: MONDAY,
    });
    expect(order.items.map((i) => [i.productId, i.quantity, i.unitPriceCents])).toEqual([[15, 2, 1225], [23, 3, 2700]]);
    expect(order.address).toMatchObject({ countryName: 'Sweden', regionName: 'Stockholm' });
    expect(stockOf(15)).toBe(stockBefore.p15 - 2);
    expect(stockOf(23)).toBe(stockBefore.p23 - 3);
    expect(getCart(db, 1, NOW)).toMatchObject({ items: [], coupon: null });
    expect(getOrderForUser(db, 1, order.id)?.number).toBe(order.number);
  });

  it('decrements the variant and the product total', () => {
    addItem(db, 2, { productId: 9, variantId: 1, quantity: 3 });
    placeOrder(db, 2, orderBody({ addressId: undefined, address: newAddress() }), NOW);
    expect(variantStock(1)).toBe(9);
    expect(stockOf(9)).toBe(17);
  });

  it('numbers orders per day from 0001 and starts again on the next day', () => {
    addItem(db, 2, { productId: 3, quantity: 1 });
    const first = placeOrder(db, 2, orderBody({ addressId: undefined, address: newAddress() }), NOW).order;
    addItem(db, 2, { productId: 3, quantity: 1 });
    const second = placeOrder(db, 2, orderBody({ addressId: undefined, address: newAddress() }), new Date('2026-10-02T20:00:00.000Z')).order;
    addItem(db, 2, { productId: 3, quantity: 1 });
    const nextDay = placeOrder(
      db,
      2,
      orderBody({ addressId: undefined, address: newAddress(), deliveryDate: '2026-10-06' }),
      new Date('2026-10-03T00:00:01.000Z'),
    ).order;
    expect([first.number, second.number, nextDay.number]).toEqual(['SL-20261002-0001', 'SL-20261002-0002', 'SL-20261003-0001']);
  });

  it('consumes ONCE5 when the order is placed, not when it is applied', () => {
    addItem(db, 2, { productId: 3, quantity: 1 });
    applyCoupon(db, 2, 'ONCE5', NOW);
    removeCoupon(db, 2);
    applyCoupon(db, 2, 'ONCE5', NOW); // applying twice before ordering is fine
    const { order } = placeOrder(db, 2, orderBody({ addressId: undefined, address: newAddress() }), NOW);
    expect(order).toMatchObject({ couponCode: 'ONCE5', discountCents: 500 });
    addItem(db, 2, { productId: 3, quantity: 1 });
    expect(failure(() => applyCoupon(db, 2, 'ONCE5', NOW)).fieldErrors?.code).toBe('ONCE5 has already been used on this account.');
    addItem(db, 1, { productId: 3, quantity: 1 });
    applyCoupon(db, 1, 'ONCE5', NOW); // another account can still use it
    expect(getCart(db, 1, NOW).coupon?.applied).toBe(true);
  });

  it('returns 409 naming the problem line and changes nothing when stock is short', () => {
    addItem(db, 2, { productId: 5, quantity: 2 });
    addItem(db, 2, { productId: 3, quantity: 1 });
    db.prepare('UPDATE products SET stock = 1 WHERE id = 5').run(); // someone else bought one
    const err = failure(() => placeOrder(db, 2, orderBody({ addressId: undefined, address: newAddress() }), NOW));
    const itemId = getCart(db, 2, NOW).items[0]!.id;
    expect(err.status).toBe(409);
    expect(Object.keys(err.fieldErrors ?? {})).toEqual([`items.${itemId}`]);
    expect(err.fieldErrors?.[`items.${itemId}`]).toContain('Only 1 of Mechanical Keyboard left');
    expect(getCart(db, 2, NOW).items).toHaveLength(2);
    expect(stockOf(3)).toBe(60);
    expect(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = 2').get()).toEqual({ n: 0 });
  });

  it('returns 402 for the declined card and keeps the cart and the stock', () => {
    addItem(db, 2, { productId: 3, quantity: 2 });
    const err = failure(() => placeOrder(db, 2, orderBody({ addressId: undefined, address: newAddress(), paymentToken: 'tok_declined_0002' }), NOW));
    expect(err.status).toBe(402);
    expect(getCart(db, 2, NOW).items).toHaveLength(1);
    expect(stockOf(3)).toBe(60);
    expect(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = 2').get()).toEqual({ n: 0 });
  });

  it('validates the request: token, terms, address, delivery date and an empty cart', () => {
    expect(failure(() => placeOrder(db, 2, orderBody(), NOW)).message).toBe('Please correct the highlighted fields.'); // address 1 belongs to user 1
    addItem(db, 2, { productId: 3, quantity: 1 });
    const address = newAddress();
    const bad = failure(() =>
      placeOrder(db, 2, orderBody({ addressId: undefined, address: { ...address, postalCode: '123' }, paymentToken: 'tok_nope', acceptTerms: false, deliveryDate: '2026-10-03' }), NOW),
    );
    expect(Object.keys(bad.fieldErrors ?? {}).sort()).toEqual(['acceptTerms', 'address.postalCode', 'deliveryDate', 'paymentToken']);
    clearCart(db, 2);
    expect(failure(() => placeOrder(db, 2, orderBody({ addressId: undefined, address }), NOW)).message).toBe('Your cart is empty.');
  });

  it('only shows an order to the account that placed it', () => {
    addItem(db, 1, { productId: 3, quantity: 1 });
    const { order } = placeOrder(db, 1, orderBody(), NOW);
    expect(getOrderForUser(db, 2, order.id)).toBeNull();
    expect(getOrderForUser(db, 1, 9999)).toBeNull();
  });

  it('restores everything on reset', () => {
    addItem(db, 1, { productId: 3, quantity: 2 });
    placeOrder(db, 1, orderBody(), NOW);
    addItem(db, 2, { productId: 6, quantity: 1 });
    seedDatabase(db, seedDir);
    expect(stockOf(3)).toBe(60);
    expect(db.prepare('SELECT COUNT(*) AS n FROM orders').get()).toEqual({ n: 3 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM cart_items').get()).toEqual({ n: 0 });
    addItem(db, 1, { productId: 3, quantity: 1 });
    expect(placeOrder(db, 1, orderBody(), NOW).order.id).toBe(4);
  });
});

describe('checkout quote', () => {
  it('prices the cart for the chosen shipping method', () => {
    addItem(db, 2, { productId: 6, quantity: 1 }); // $24.99
    const standard = quoteCheckout(db, 2, { shippingMethod: 'standard', country: 'SE' }, NOW);
    const express = quoteCheckout(db, 2, { shippingMethod: 'express', country: 'US' }, NOW);
    expect(standard.totals).toMatchObject({ shippingCents: 500, taxCents: 250, totalCents: 2499 + 500 + 250 });
    expect(express.totals).toMatchObject({ shippingCents: 1500, totalCents: 2499 + 1500 + 250 });
    expect(standard.deliveryWindow).toEqual({ earliest: '2026-10-03', latest: '2026-10-16' });
  });

  it('rejects an unknown country or method, and an empty cart', () => {
    expect(failure(() => quoteCheckout(db, 2, { shippingMethod: 'standard', country: 'SE' }, NOW)).message).toBe('Your cart is empty.');
    addItem(db, 2, { productId: 6, quantity: 1 });
    const err = failure(() => quoteCheckout(db, 2, { shippingMethod: 'drone', country: 'XX' }, NOW));
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(['country', 'shippingMethod']);
  });
});

function newAddress() {
  return {
    firstName: 'Sam',
    lastName: 'Shopper',
    street: '1 Test Street',
    countryCode: 'US',
    regionCode: 'CA',
    postalCode: '90001',
    phone: '+1 555 010 0100',
  };
}
