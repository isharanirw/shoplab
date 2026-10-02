import { f02, f07, f13 } from '../testability/variants';

export type ShippingMethod = 'standard' | 'express';
export const SHIPPING_METHODS: readonly ShippingMethod[] = ['standard', 'express'];

export const STANDARD_SHIPPING_CENTS = 500;
export const EXPRESS_SHIPPING_CENTS = 1500;
/** Standard shipping is free when the subtotal after discount reaches this amount. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 10_000;
export const TAX_PERCENT = 10;

export function isShippingMethod(value: unknown): value is ShippingMethod {
  return value === 'standard' || value === 'express';
}

/** numerator / denominator for non-negative integers, rounded half up, without floating point. */
export function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** `percent` percent of an amount in cents, rounded half up to a whole cent. */
export function percentOf(cents: number, percent: number): number {
  return roundHalfUp(cents * percent, 100);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export interface CouponRule {
  code: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  /** Percent for `percent`, cents for `fixed`, unused for `free_shipping`. */
  value: number;
  minSubtotalCents: number;
  oncePerAccount: boolean;
  /** ISO timestamp, or null when the coupon never expires. */
  expiresAt: string | null;
}

export type CouponRejection = 'expired' | 'below_minimum' | 'already_used';

export type CouponCheck = { ok: true } | { ok: false; reason: CouponRejection; message: string };

export interface CouponContext {
  subtotalCents: number;
  now: Date;
  /** True when this account has already placed an order with the coupon. */
  usedByAccount: boolean;
}

/** Decides whether a coupon may be used right now. Order of checks: expired, already used, minimum. */
export function checkCoupon(coupon: CouponRule, ctx: CouponContext): CouponCheck {
  if (coupon.expiresAt !== null && new Date(coupon.expiresAt).getTime() <= ctx.now.getTime()) {
    return { ok: false, reason: 'expired', message: `${coupon.code} has expired.` };
  }
  if (coupon.oncePerAccount && ctx.usedByAccount) {
    return { ok: false, reason: 'already_used', message: `${coupon.code} has already been used on this account.` };
  }
  if (f13(ctx.subtotalCents, coupon.minSubtotalCents)) {
    return {
      ok: false,
      reason: 'below_minimum',
      message: `${coupon.code} needs a subtotal of ${formatCents(coupon.minSubtotalCents)} or more.`,
    };
  }
  return { ok: true };
}

export interface PricedLine {
  /** The price a customer pays for one unit (the sale price when the product is on sale). */
  unitPriceCents: number;
  quantity: number;
}

export interface PricingInput {
  lines: PricedLine[];
  shippingMethod: ShippingMethod;
  coupon: CouponRule | null;
  now: Date;
  couponUsedByAccount: boolean;
}

export interface CouponOutcome {
  code: string;
  /** False when the coupon is attached to the cart but does not currently apply. */
  applied: boolean;
  reason: CouponRejection | null;
  message: string | null;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  shippingMethod: ShippingMethod;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  coupon: CouponOutcome | null;
}

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

/**
 * Prices a cart in integer cents. Rounding is half up at the discount and tax steps.
 * subtotal = sum(price x quantity); discount = at most one coupon applied to the subtotal;
 * shipping = Standard 500 (free from 10000 after discount) or Express 1500 (never free);
 * tax = 10% of (subtotal - discount), shipping not taxed; total = subtotal - discount + shipping + tax.
 * A coupon that does not currently qualify is reported in `coupon` but changes nothing.
 */
export function computeTotals(input: PricingInput): Totals {
  const subtotalCents = subtotalOf(input.lines);

  let discountCents = 0;
  let waiveStandardShipping = false;
  let outcome: CouponOutcome | null = null;
  if (input.coupon) {
    const check = checkCoupon(input.coupon, {
      subtotalCents,
      now: input.now,
      usedByAccount: input.couponUsedByAccount,
    });
    if (check.ok) {
      outcome = { code: input.coupon.code, applied: true, reason: null, message: null };
      if (input.coupon.kind === 'percent') discountCents = percentOf(subtotalCents, input.coupon.value);
      else if (input.coupon.kind === 'fixed') discountCents = Math.min(input.coupon.value, subtotalCents);
      else waiveStandardShipping = true;
    } else {
      outcome = { code: input.coupon.code, applied: false, reason: check.reason, message: check.message };
    }
  }
  discountCents = Math.min(discountCents, subtotalCents);

  const afterDiscount = subtotalCents - discountCents;
  let shippingCents = 0;
  if (subtotalCents > 0) {
    if (input.shippingMethod === 'express') {
      shippingCents = EXPRESS_SHIPPING_CENTS;
    } else {
      const free = waiveStandardShipping || f02(afterDiscount, subtotalCents) >= FREE_SHIPPING_THRESHOLD_CENTS;
      shippingCents = free ? 0 : STANDARD_SHIPPING_CENTS;
    }
  }

  const taxCents = f07(afterDiscount, TAX_PERCENT, percentOf(afterDiscount, TAX_PERCENT));
  return {
    subtotalCents,
    discountCents,
    shippingMethod: input.shippingMethod,
    shippingCents,
    taxCents,
    totalCents: afterDiscount + shippingCents + taxCents,
    coupon: outcome,
  };
}
