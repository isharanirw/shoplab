import { describe, expect, it } from 'vitest';
import { checkCoupon, computeTotals, formatCents, percentOf, roundHalfUp } from './pricing';
import type { CouponRule, PricedLine, ShippingMethod } from './pricing';

const NOW = new Date('2026-10-02T12:00:00.000Z');

const COUPONS: Record<string, CouponRule> = {
  SAVE10: { code: 'SAVE10', kind: 'percent', value: 10, minSubtotalCents: 0, oncePerAccount: false, expiresAt: null },
  FREESHIP: { code: 'FREESHIP', kind: 'free_shipping', value: 0, minSubtotalCents: 3000, oncePerAccount: false, expiresAt: null },
  MIN100: { code: 'MIN100', kind: 'fixed', value: 2000, minSubtotalCents: 10000, oncePerAccount: false, expiresAt: null },
  ONCE5: { code: 'ONCE5', kind: 'fixed', value: 500, minSubtotalCents: 0, oncePerAccount: true, expiresAt: null },
  EXPIRED20: { code: 'EXPIRED20', kind: 'percent', value: 20, minSubtotalCents: 0, oncePerAccount: false, expiresAt: '2020-01-01T00:00:00.000Z' },
};

function price(
  lines: PricedLine[],
  opts: { shipping?: ShippingMethod; coupon?: keyof typeof COUPONS; used?: boolean; now?: Date } = {},
) {
  return computeTotals({
    lines,
    shippingMethod: opts.shipping ?? 'standard',
    coupon: opts.coupon ? COUPONS[opts.coupon]! : null,
    now: opts.now ?? NOW,
    couponUsedByAccount: opts.used ?? false,
  });
}

/** One line worth exactly `cents`. */
const worth = (cents: number): PricedLine[] => [{ unitPriceCents: cents, quantity: 1 }];

describe('rounding helpers', () => {
  it('rounds half up for non-negative integers', () => {
    expect(roundHalfUp(1, 2)).toBe(1);
    expect(roundHalfUp(1, 3)).toBe(0);
    expect(roundHalfUp(2, 3)).toBe(1);
    expect(percentOf(5, 10)).toBe(1); // 0.5 cent
    expect(percentOf(4, 10)).toBe(0); // 0.4 cent
    expect(percentOf(15, 10)).toBe(2); // 1.5 cents
    expect(percentOf(1005, 10)).toBe(101); // 100.5 cents
  });

  it('formats cents as dollars', () => {
    expect(formatCents(10945)).toBe('$109.45');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(-1055)).toBe('-$10.55');
  });
});

describe('pricing: worked example from the requirements', () => {
  it('2 x $30.00 + 1 x $45.50 with SAVE10 and Standard shipping totals $109.45', () => {
    const totals = price(
      [
        { unitPriceCents: 3000, quantity: 2 },
        { unitPriceCents: 4550, quantity: 1 },
      ],
      { coupon: 'SAVE10' },
    );
    expect(totals.subtotalCents).toBe(10550);
    expect(totals.discountCents).toBe(1055);
    expect(totals.subtotalCents - totals.discountCents).toBe(9495);
    expect(totals.shippingCents).toBe(500);
    expect(totals.taxCents).toBe(950);
    expect(totals.totalCents).toBe(10945);
    expect(totals.coupon).toEqual({ code: 'SAVE10', applied: true, reason: null, message: null });
  });
});

describe('pricing: rounding at the discount and tax steps', () => {
  it('rounds a discount that lands on exactly half a cent up', () => {
    // 10% of $10.05 is 100.5 cents -> 101. Then 904 left, tax 90.4 -> 90.
    const totals = price(worth(1005), { coupon: 'SAVE10' });
    expect(totals.discountCents).toBe(101);
    expect(totals.taxCents).toBe(90);
    expect(totals.totalCents).toBe(904 + 500 + 90);
  });

  it('rounds tax that lands on exactly half a cent up', () => {
    // No coupon: 10% of $10.05 is 100.5 cents -> 101.
    const totals = price(worth(1005));
    expect(totals.taxCents).toBe(101);
    expect(totals.totalCents).toBe(1005 + 500 + 101);
  });

  it('does not tax shipping', () => {
    const standard = price(worth(2000));
    const express = price(worth(2000), { shipping: 'express' });
    expect(standard.taxCents).toBe(200);
    expect(express.taxCents).toBe(200);
    expect(express.totalCents - standard.totalCents).toBe(1000);
  });

  it('sums price x quantity per line', () => {
    const totals = price([
      { unitPriceCents: 1999, quantity: 3 },
      { unitPriceCents: 501, quantity: 2 },
    ]);
    expect(totals.subtotalCents).toBe(1999 * 3 + 501 * 2);
  });
});

describe('pricing: FREESHIP', () => {
  it('is rejected at $29.99 and the shipping stays $5.00', () => {
    expect(checkCoupon(COUPONS.FREESHIP!, { subtotalCents: 2999, now: NOW, usedByAccount: false })).toEqual({
      ok: false,
      reason: 'below_minimum',
      message: 'FREESHIP needs a subtotal of $30.00 or more.',
    });
    const totals = price(worth(2999), { coupon: 'FREESHIP' });
    expect(totals.coupon?.applied).toBe(false);
    expect(totals.shippingCents).toBe(500);
  });

  it('waives Standard shipping at $30.00 without a money discount', () => {
    const totals = price(worth(3000), { coupon: 'FREESHIP' });
    expect(totals.coupon?.applied).toBe(true);
    expect(totals.discountCents).toBe(0);
    expect(totals.shippingCents).toBe(0);
    expect(totals.taxCents).toBe(300);
    expect(totals.totalCents).toBe(3300);
  });

  it('does not waive Express shipping', () => {
    const totals = price(worth(3000), { coupon: 'FREESHIP', shipping: 'express' });
    expect(totals.shippingCents).toBe(1500);
  });
});

describe('pricing: MIN100', () => {
  it('is rejected at $99.99', () => {
    const totals = price(worth(9999), { coupon: 'MIN100' });
    expect(totals.coupon).toMatchObject({ applied: false, reason: 'below_minimum' });
    expect(totals.discountCents).toBe(0);
  });

  it('takes $20.00 off at $100.00 (the minimum is checked on the subtotal before discount)', () => {
    const totals = price(worth(10000), { coupon: 'MIN100' });
    expect(totals.discountCents).toBe(2000);
    expect(totals.shippingCents).toBe(500); // $80.00 after discount is under the free-shipping line
    expect(totals.taxCents).toBe(800);
    expect(totals.totalCents).toBe(8000 + 500 + 800);
  });
});

describe('pricing: shipping', () => {
  it('Standard is $5.00 at $99.99 after discount and free at $100.00', () => {
    expect(price(worth(9999)).shippingCents).toBe(500);
    expect(price(worth(10000)).shippingCents).toBe(0);
  });

  it('uses the subtotal after discount for the free-shipping line', () => {
    // SAVE10 on $111.11 takes 1111 off (1111.1 rounds down), leaving exactly $100.00: free.
    const exact = price(worth(11111), { coupon: 'SAVE10' });
    expect(exact.discountCents).toBe(1111);
    expect(exact.shippingCents).toBe(0);
    // SAVE10 on $111.10 leaves $99.99: not free.
    const under = price(worth(11110), { coupon: 'SAVE10' });
    expect(under.discountCents).toBe(1111);
    expect(under.shippingCents).toBe(500);
  });

  it('Express is $15.00 and never free', () => {
    expect(price(worth(50000), { shipping: 'express' }).shippingCents).toBe(1500);
    expect(price(worth(50000), { shipping: 'express', coupon: 'SAVE10' }).shippingCents).toBe(1500);
  });

  it('charges no shipping for an empty cart', () => {
    const totals = price([]);
    expect(totals).toMatchObject({ subtotalCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe('pricing: other coupons', () => {
  it('ONCE5 takes $5.00 off the first time', () => {
    const totals = price(worth(2000), { coupon: 'ONCE5' });
    expect(totals.discountCents).toBe(500);
    expect(totals.taxCents).toBe(150);
    expect(totals.totalCents).toBe(1500 + 500 + 150);
  });

  it('ONCE5 is rejected once the account has used it', () => {
    const check = checkCoupon(COUPONS.ONCE5!, { subtotalCents: 2000, now: NOW, usedByAccount: true });
    expect(check).toMatchObject({ ok: false, reason: 'already_used' });
    const totals = price(worth(2000), { coupon: 'ONCE5', used: true });
    expect(totals.coupon).toMatchObject({ applied: false, reason: 'already_used' });
    expect(totals.discountCents).toBe(0);
  });

  it('a fixed discount never exceeds the subtotal', () => {
    const totals = price(worth(300), { coupon: 'ONCE5' });
    expect(totals.discountCents).toBe(300);
    expect(totals.taxCents).toBe(0);
    expect(totals.totalCents).toBe(500);
  });

  it('EXPIRED20 is always rejected as expired', () => {
    expect(checkCoupon(COUPONS.EXPIRED20!, { subtotalCents: 50000, now: NOW, usedByAccount: false })).toEqual({
      ok: false,
      reason: 'expired',
      message: 'EXPIRED20 has expired.',
    });
    const totals = price(worth(50000), { coupon: 'EXPIRED20' });
    expect(totals.discountCents).toBe(0);
    expect(totals.coupon).toMatchObject({ applied: false, reason: 'expired' });
  });

  it('a coupon expires at its expiry instant', () => {
    const coupon: CouponRule = { ...COUPONS.SAVE10!, code: 'TIMED', expiresAt: '2026-10-02T12:00:00.000Z' };
    expect(checkCoupon(coupon, { subtotalCents: 1000, now: new Date('2026-10-02T11:59:59.999Z'), usedByAccount: false }).ok).toBe(true);
    expect(checkCoupon(coupon, { subtotalCents: 1000, now: NOW, usedByAccount: false }).ok).toBe(false);
  });

  it('a coupon that stops qualifying contributes nothing and re-qualifies when the cart grows', () => {
    const small = price(worth(9000), { coupon: 'MIN100' });
    expect(small.coupon).toMatchObject({ code: 'MIN100', applied: false });
    expect(small.discountCents).toBe(0);
    const large = price(worth(12000), { coupon: 'MIN100' });
    expect(large.coupon).toMatchObject({ applied: true });
    expect(large.discountCents).toBe(2000);
  });
});
