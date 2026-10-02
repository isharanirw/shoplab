import type { Db } from '../db/connection';
import { deliveryWindow } from '../lib/delivery';
import { ApiError } from '../lib/errors';
import { isShippingMethod } from '../lib/pricing';
import type { ShippingMethod } from '../lib/pricing';
import { priceCart, toCartView } from './cart';
import type { CartView } from './cart';
import { listCountries } from './locations';

export interface QuoteView extends CartView {
  shippingMethod: ShippingMethod;
  country: string;
  deliveryWindow: { earliest: string; latest: string };
}

/**
 * Totals preview for the chosen shipping method and destination country. Prices do not depend on the
 * country (tax is a flat 10% and shipping is the same everywhere), but the country must be one we ship to.
 */
export function quoteCheckout(db: Db, userId: number, rawBody: unknown, now: Date = new Date()): QuoteView {
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? (rawBody as Record<string, unknown>) : {};
  const fieldErrors: Record<string, string> = {};
  if (!isShippingMethod(body.shippingMethod)) fieldErrors.shippingMethod = 'Choose standard or express shipping.';
  const countries = listCountries(db);
  if (typeof body.country !== 'string' || !countries.some((c) => c.code === body.country)) {
    fieldErrors.country = `Country must be one of ${countries.map((c) => c.code).join(', ')}.`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors });
  }
  const method = body.shippingMethod as ShippingMethod;
  const priced = priceCart(db, userId, method, now);
  if (priced.items.length === 0) throw new ApiError('VALIDATION_ERROR', 'Your cart is empty.');
  return { ...toCartView(priced), shippingMethod: method, country: body.country as string, deliveryWindow: deliveryWindow(now) };
}
