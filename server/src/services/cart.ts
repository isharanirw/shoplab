import type { Db } from '../db/connection';
import { ApiError } from '../lib/errors';
import { lineLimit, mergeCartLines, parseQuantity, quantityProblem } from '../lib/cartRules';
import type { MergeAdjustment, MergeLine } from '../lib/cartRules';
import { checkCoupon, computeTotals } from '../lib/pricing';
import type { CouponOutcome, CouponRule, ShippingMethod, Totals } from '../lib/pricing';

export interface CartItemView {
  id: number;
  productId: number;
  variantId: number | null;
  name: string;
  category: string;
  imageCount: number;
  variantLabel: string | null;
  unitPriceCents: number;
  regularPriceCents: number;
  onSale: boolean;
  quantity: number;
  lineTotalCents: number;
  /** Units currently available for this product or variant. */
  stock: number;
  /** The most this line can hold right now: min(10, stock). */
  maxQuantity: number;
  inStock: boolean;
}

export interface CouponView {
  code: string;
  description: string;
  /** False when the coupon is attached but does not qualify right now (see `message`). */
  applied: boolean;
  reason: CouponOutcome['reason'];
  message: string | null;
}

export type TotalsView = Omit<Totals, 'coupon'>;

export interface CartView {
  items: CartItemView[];
  /** Total units across all lines; this is the header badge number. */
  itemCount: number;
  coupon: CouponView | null;
  totals: TotalsView;
}

interface LineRow {
  id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  name: string;
  category: string;
  image_count: number;
  active: number;
  price_cents: number;
  sale_price_cents: number | null;
  product_stock: number;
  size: string | null;
  colour: string | null;
  variant_stock: number | null;
}

interface CouponRow {
  code: string;
  kind: CouponRule['kind'];
  value: number;
  min_subtotal_cents: number;
  once_per_account: number;
  expires_at: string | null;
  description: string;
}

export function variantLabel(size: string | null, colour: string | null): string | null {
  const parts = [size, colour].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' / ') : null;
}

export function loadCartLines(db: Db, userId: number): CartItemView[] {
  const rows = db
    .prepare(
      `SELECT ci.id, ci.product_id, ci.variant_id, ci.quantity, p.name, p.category, p.image_count, p.active,
              p.price_cents, p.sale_price_cents, p.stock AS product_stock, v.size, v.colour, v.stock AS variant_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants v ON v.id = ci.variant_id
       WHERE ci.user_id = ?
       ORDER BY ci.id`,
    )
    .all(userId) as LineRow[];
  return rows.map((row) => {
    const stock = row.active === 1 ? (row.variant_id !== null ? (row.variant_stock ?? 0) : row.product_stock) : 0;
    const unit = row.sale_price_cents ?? row.price_cents;
    return {
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      name: row.name,
      category: row.category,
      imageCount: row.image_count,
      variantLabel: variantLabel(row.size, row.colour),
      unitPriceCents: unit,
      regularPriceCents: row.price_cents,
      onSale: row.sale_price_cents !== null,
      quantity: row.quantity,
      lineTotalCents: unit * row.quantity,
      stock,
      maxQuantity: lineLimit(stock),
      inStock: stock > 0,
    };
  });
}

export function getCouponRule(db: Db, code: string): (CouponRule & { description: string }) | null {
  const row = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) as CouponRow | undefined;
  if (!row) return null;
  return {
    code: row.code,
    kind: row.kind,
    value: row.value,
    minSubtotalCents: row.min_subtotal_cents,
    oncePerAccount: row.once_per_account === 1,
    expiresAt: row.expires_at,
    description: row.description,
  };
}

/** A coupon counts as used once the account has an order that carries its code. */
export function couponUsedByAccount(db: Db, userId: number, code: string): boolean {
  return db.prepare('SELECT 1 FROM orders WHERE user_id = ? AND coupon_code = ?').get(userId, code) !== undefined;
}

export function appliedCouponCode(db: Db, userId: number): string | null {
  const row = db.prepare('SELECT coupon_code FROM carts WHERE user_id = ?').get(userId) as { coupon_code: string | null } | undefined;
  return row?.coupon_code ?? null;
}

export interface PricedCart {
  items: CartItemView[];
  itemCount: number;
  coupon: CouponView | null;
  totals: Totals;
}

/** Loads a user's cart and prices it for a shipping method. Used by the cart, the quote and checkout. */
export function priceCart(db: Db, userId: number, shippingMethod: ShippingMethod, now: Date): PricedCart {
  const items = loadCartLines(db, userId);
  const code = appliedCouponCode(db, userId);
  const rule = code ? getCouponRule(db, code) : null;
  const totals = computeTotals({
    lines: items,
    shippingMethod,
    coupon: rule,
    now,
    couponUsedByAccount: rule ? couponUsedByAccount(db, userId, rule.code) : false,
  });
  const coupon: CouponView | null =
    rule && totals.coupon
      ? {
          code: rule.code,
          description: rule.description,
          applied: totals.coupon.applied,
          reason: totals.coupon.reason,
          message: totals.coupon.message,
        }
      : null;
  return { items, itemCount: items.reduce((n, i) => n + i.quantity, 0), coupon, totals };
}

export function toCartView(priced: PricedCart): CartView {
  const { coupon: _ignored, ...totals } = priced.totals;
  void _ignored;
  return { items: priced.items, itemCount: priced.itemCount, coupon: priced.coupon, totals };
}

/** The cart as the API returns it: lines, badge count, coupon status and totals (Standard shipping). */
export function getCart(db: Db, userId: number, now: Date = new Date()): CartView {
  return toCartView(priceCart(db, userId, 'standard', now));
}

interface ProductStockRow {
  id: number;
  stock: number;
  active: number;
  variant_count: number;
}

interface VariantRow {
  id: number;
  product_id: number;
  stock: number;
}

function productRow(db: Db, productId: number): ProductStockRow | undefined {
  return db
    .prepare(
      `SELECT p.id, p.stock, p.active, (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count
       FROM products p WHERE p.id = ?`,
    )
    .get(productId) as ProductStockRow | undefined;
}

function parseIdField(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ApiError('VALIDATION_ERROR', `${field} must be a positive whole number.`, {
      fieldErrors: { [field]: 'Must be a positive whole number.' },
    });
  }
  return value;
}

export interface AddItemInput {
  productId: unknown;
  variantId?: unknown;
  quantity: unknown;
}

/** Adds a line, or merges into the existing line for the same product and variant. */
export function addItem(db: Db, userId: number, input: AddItemInput, now: Date = new Date()): { created: boolean } {
  const productId = parseIdField(input.productId, 'productId');
  const quantity = parseQuantity(input.quantity);
  const variantId = input.variantId === undefined || input.variantId === null ? null : parseIdField(input.variantId, 'variantId');

  const product = productRow(db, productId);
  if (!product || product.active !== 1) throw new ApiError('NOT_FOUND', 'Product not found.');

  let stock = product.stock;
  if (product.variant_count > 0) {
    if (variantId === null) {
      throw new ApiError('VALIDATION_ERROR', 'Choose a size or colour for this product.', {
        fieldErrors: { variantId: 'This product needs a variant.' },
      });
    }
    const variant = db.prepare('SELECT id, product_id, stock FROM product_variants WHERE id = ?').get(variantId) as VariantRow | undefined;
    if (!variant || variant.product_id !== productId) {
      throw new ApiError('VALIDATION_ERROR', 'That variant does not belong to this product.', {
        fieldErrors: { variantId: 'Unknown variant for this product.' },
      });
    }
    stock = variant.stock;
  } else if (variantId !== null) {
    throw new ApiError('VALIDATION_ERROR', 'This product has no variants.', {
      fieldErrors: { variantId: 'This product has no variants.' },
    });
  }

  const existing = db
    .prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND COALESCE(variant_id, 0) = ?')
    .get(userId, productId, variantId ?? 0) as { id: number; quantity: number } | undefined;
  const total = (existing?.quantity ?? 0) + quantity;
  const problem = quantityProblem(total, stock);
  if (problem) {
    const note = existing ? ` You already have ${existing.quantity} in your cart.` : '';
    throw new ApiError('CONFLICT', `${problem}${note}`, { fieldErrors: { quantity: `${problem}${note}` } });
  }

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(total, existing.id);
    return { created: false };
  }
  db.prepare('INSERT INTO cart_items (user_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    productId,
    variantId,
    quantity,
    now.toISOString(),
  );
  return { created: true };
}

function ownedItem(db: Db, userId: number, itemId: number): LineRow {
  const rows = db
    .prepare(
      `SELECT ci.id, ci.product_id, ci.variant_id, ci.quantity, p.name, p.category, p.image_count, p.active,
              p.price_cents, p.sale_price_cents, p.stock AS product_stock, v.size, v.colour, v.stock AS variant_stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants v ON v.id = ci.variant_id
       WHERE ci.id = ? AND ci.user_id = ?`,
    )
    .all(itemId, userId) as LineRow[];
  const row = rows[0];
  if (!row) throw new ApiError('NOT_FOUND', 'That item is not in your cart.');
  return row;
}

/** Sets a line's quantity (1 to 10, and not above the stock). */
export function setItemQuantity(db: Db, userId: number, itemId: number, quantityInput: unknown): void {
  const row = ownedItem(db, userId, itemId);
  const quantity = parseQuantity(quantityInput);
  const stock = row.active === 1 ? (row.variant_id !== null ? (row.variant_stock ?? 0) : row.product_stock) : 0;
  const problem = quantityProblem(quantity, stock);
  if (problem) throw new ApiError('CONFLICT', problem, { fieldErrors: { quantity: problem } });
  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
}

export function removeItem(db: Db, userId: number, itemId: number): void {
  ownedItem(db, userId, itemId);
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
}

/** Empties the cart and detaches any coupon. */
export function clearCart(db: Db, userId: number): void {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM carts WHERE user_id = ?').run(userId);
}

/** Codes are matched ignoring case and surrounding spaces. */
export function normaliseCouponCode(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError('VALIDATION_ERROR', 'Enter a coupon code.', { fieldErrors: { code: 'Enter a coupon code.' } });
  }
  return value.trim().toUpperCase();
}

function couponError(message: string): ApiError {
  return new ApiError('VALIDATION_ERROR', message, { fieldErrors: { code: message } });
}

/**
 * Attaches one coupon to the cart. It is rejected when it is unknown, expired, already used by this
 * account, below its minimum subtotal, or when another coupon is already attached.
 */
export function applyCoupon(db: Db, userId: number, codeInput: unknown, now: Date = new Date()): void {
  const code = normaliseCouponCode(codeInput);
  const current = appliedCouponCode(db, userId);
  if (current) {
    throw new ApiError('CONFLICT', `${current} is already applied. Remove it before applying another coupon.`, {
      fieldErrors: { code: `${current} is already applied.` },
    });
  }
  const rule = getCouponRule(db, code);
  if (!rule) throw couponError('That coupon code is not valid.');
  const items = loadCartLines(db, userId);
  if (items.length === 0) throw couponError('Add items to your cart before applying a coupon.');
  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
  const check = checkCoupon(rule, { subtotalCents, now, usedByAccount: couponUsedByAccount(db, userId, code) });
  if (!check.ok) throw couponError(check.message);
  db.prepare('INSERT INTO carts (user_id, coupon_code) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET coupon_code = excluded.coupon_code').run(
    userId,
    code,
  );
}

export function removeCoupon(db: Db, userId: number): void {
  db.prepare('DELETE FROM carts WHERE user_id = ?').run(userId);
}

export interface MergeReport extends MergeAdjustment {
  name: string;
}

function parseMergeLines(raw: unknown): MergeLine[] {
  if (!Array.isArray(raw) || raw.length > 100) {
    throw new ApiError('VALIDATION_ERROR', 'items must be a list of up to 100 cart lines.', {
      fieldErrors: { items: 'Must be a list of up to 100 lines.' },
    });
  }
  return raw.map((entry, index) => {
    const line = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    try {
      return {
        productId: parseIdField(line.productId, 'productId'),
        variantId: line.variantId === undefined || line.variantId === null ? null : parseIdField(line.variantId, 'variantId'),
        quantity: parseQuantity(line.quantity),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        throw new ApiError('VALIDATION_ERROR', `items[${index}]: ${err.message}`, {
          fieldErrors: { [`items.${index}`]: err.message },
        });
      }
      throw err;
    }
  });
}

/**
 * Merges a guest cart into the user's server cart (called right after login). Quantities of the same
 * product and variant add up and are capped at min(10, stock); products that are gone or sold out
 * are skipped. Returns what was changed so the UI can tell the shopper.
 */
export function mergeGuestCart(db: Db, userId: number, raw: unknown, now: Date = new Date()): MergeReport[] {
  const incoming = parseMergeLines(raw);
  const existing = loadCartLines(db, userId).map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));

  const stockOf = (productId: number, variantId: number | null): number | null => {
    const product = productRow(db, productId);
    if (!product || product.active !== 1) return null;
    if (product.variant_count > 0) {
      if (variantId === null) return null;
      const variant = db.prepare('SELECT id, product_id, stock FROM product_variants WHERE id = ?').get(variantId) as VariantRow | undefined;
      return variant && variant.product_id === productId ? variant.stock : null;
    }
    return variantId === null ? product.stock : null;
  };

  const result = mergeCartLines(existing, incoming, stockOf);
  const keyOf = (l: { productId: number; variantId: number | null }) => `${l.productId}:${l.variantId ?? 0}`;
  const touched = new Set(incoming.map(keyOf));
  const resulting = new Map(result.lines.map((l) => [keyOf(l), l.quantity]));

  const apply = db.transaction(() => {
    for (const key of touched) {
      const [productIdText, variantText] = key.split(':');
      const productId = Number(productIdText);
      const variantKey = Number(variantText);
      const quantity = resulting.get(key);
      const current = db
        .prepare('SELECT id FROM cart_items WHERE user_id = ? AND product_id = ? AND COALESCE(variant_id, 0) = ?')
        .get(userId, productId, variantKey) as { id: number } | undefined;
      if (quantity === undefined) {
        if (current) db.prepare('DELETE FROM cart_items WHERE id = ?').run(current.id);
      } else if (current) {
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, current.id);
      } else {
        db.prepare('INSERT INTO cart_items (user_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)').run(
          userId,
          productId,
          variantKey === 0 ? null : variantKey,
          quantity,
          now.toISOString(),
        );
      }
    }
  });
  apply();

  return result.adjustments.map((a) => {
    const row = db.prepare('SELECT name FROM products WHERE id = ?').get(a.productId) as { name: string } | undefined;
    return { ...a, name: row?.name ?? `Product ${a.productId}` };
  });
}
