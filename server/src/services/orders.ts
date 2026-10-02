import type { Db } from '../db/connection';
import { validateAddress } from '../lib/address';
import type { AddressInput } from '../lib/address';
import { validateDeliveryDate } from '../lib/delivery';
import { ApiError } from '../lib/errors';
import { formatOrderNumber, nextSequence, orderNumberPrefix } from '../lib/orderNumber';
import { ORDER_SORT_SQL } from '../lib/orderQuery';
import type { OrderListQuery } from '../lib/orderQuery';
import { parsePaymentToken } from '../lib/payment';
import { isShippingMethod } from '../lib/pricing';
import type { ShippingMethod } from '../lib/pricing';
import { priceCart } from './cart';
import { findAddress, listCountries } from './locations';
import type { ListResult } from './locations';

export interface OrderItemView {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderAddressView {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
  postalCode: string;
  phone: string;
}

export interface OrderView {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  deliveryDate: string;
  couponCode: string | null;
  shippingMethod: ShippingMethod;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  paymentLast4: string;
  address: OrderAddressView;
  items: OrderItemView[];
}

interface OrderRow {
  id: number;
  number: string;
  user_id: number;
  status: string;
  created_at: string;
  delivery_date: string;
  coupon_code: string | null;
  shipping_method: ShippingMethod;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_last4: string;
  address: string;
}

interface ItemRow {
  product_id: number;
  variant_id: number | null;
  name: string;
  variant_label: string | null;
  unit_price_cents: number;
  quantity: number;
}

function enrichAddress(db: Db, stored: Partial<AddressInput>): OrderAddressView {
  const countries = listCountries(db);
  const country = countries.find((c) => c.code === stored.countryCode);
  const region = country?.regions.find((r) => r.code === stored.regionCode);
  return {
    firstName: stored.firstName ?? '',
    lastName: stored.lastName ?? '',
    street: stored.street ?? '',
    city: stored.city ?? '',
    regionCode: stored.regionCode ?? '',
    regionName: region?.name ?? stored.regionCode ?? '',
    countryCode: stored.countryCode ?? '',
    countryName: country?.name ?? stored.countryCode ?? '',
    postalCode: stored.postalCode ?? '',
    phone: stored.phone ?? '',
  };
}

function toOrderView(db: Db, row: OrderRow): OrderView {
  const items = db
    .prepare('SELECT product_id, variant_id, name, variant_label, unit_price_cents, quantity FROM order_items WHERE order_id = ? ORDER BY id')
    .all(row.id) as ItemRow[];
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    createdAt: row.created_at,
    deliveryDate: row.delivery_date,
    couponCode: row.coupon_code,
    shippingMethod: row.shipping_method,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    paymentLast4: row.payment_last4,
    address: enrichAddress(db, JSON.parse(row.address) as Partial<AddressInput>),
    items: items.map((i) => ({
      productId: i.product_id,
      variantId: i.variant_id,
      name: i.name,
      variantLabel: i.variant_label,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
      lineTotalCents: i.unit_price_cents * i.quantity,
    })),
  };
}

/** An order of the given user, or null. Other users' orders look the same as missing ones. */
export function getOrderForUser(db: Db, userId: number, orderId: number): OrderView | null {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId) as OrderRow | undefined;
  return row ? toOrderView(db, row) : null;
}

export interface PlaceOrderResult {
  order: OrderView;
}

/**
 * Places an order from the user's cart, all inside one transaction:
 * validate the request (400), check stock for every line (409 with one entry per problem line in
 * `fieldErrors` keyed `items.<cartItemId>`), then charge the simulated payment token (402 when
 * declined). On success stock is decremented (per variant where one is used), the cart and its
 * coupon are cleared, and the order is stored with status Processing. Nothing changes on failure.
 */
export function placeOrder(db: Db, userId: number, rawBody: unknown, now: Date = new Date()): PlaceOrderResult {
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? (rawBody as Record<string, unknown>) : {};
  const fieldErrors: Record<string, string> = {};

  const method = isShippingMethod(body.shippingMethod) ? body.shippingMethod : null;
  if (!method) fieldErrors.shippingMethod = 'Choose standard or express shipping.';
  if (method) {
    const dateErr = validateDeliveryDate(body.deliveryDate, method, now);
    if (dateErr) fieldErrors.deliveryDate = dateErr;
  }

  let address: AddressInput | null = null;
  const hasSaved = body.addressId !== undefined && body.addressId !== null;
  const hasNew = body.address !== undefined && body.address !== null;
  if (hasSaved === hasNew) {
    fieldErrors.address = 'Send either addressId (a saved address) or address (a new one).';
  } else if (hasSaved) {
    const id = typeof body.addressId === 'number' && Number.isInteger(body.addressId) ? body.addressId : null;
    const saved = id === null ? null : findAddress(db, userId, id);
    if (!saved) {
      fieldErrors.addressId = 'Choose one of your saved addresses.';
    } else {
      address = {
        firstName: saved.firstName,
        lastName: saved.lastName,
        street: saved.street,
        city: saved.city,
        countryCode: saved.countryCode,
        regionCode: saved.regionCode,
        postalCode: saved.postalCode,
        phone: saved.phone,
      };
    }
  } else {
    const result = validateAddress(body.address, listCountries(db));
    if (result.ok) address = result.address;
    else for (const [field, message] of Object.entries(result.fieldErrors)) fieldErrors[`address.${field}`] = message;
  }

  const payment = parsePaymentToken(body.paymentToken);
  if (!payment) fieldErrors.paymentToken = 'The payment details are invalid. Enter a valid card.';
  if (body.acceptTerms !== true) fieldErrors.acceptTerms = 'You must accept the terms and conditions.';

  if (Object.keys(fieldErrors).length > 0 || !method || !address || !payment) {
    throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors });
  }

  const place = db.transaction((): number => {
    const priced = priceCart(db, userId, method, now);
    if (priced.items.length === 0) throw new ApiError('VALIDATION_ERROR', 'Your cart is empty.');

    const stockErrors: Record<string, string> = {};
    for (const item of priced.items) {
      if (item.quantity > item.stock) {
        const label = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
        stockErrors[`items.${item.id}`] =
          item.stock <= 0 ? `${label} is out of stock.` : `Only ${item.stock} of ${label} left, but you have ${item.quantity} in your cart.`;
      }
    }
    if (Object.keys(stockErrors).length > 0) {
      throw new ApiError('CONFLICT', 'Some items are no longer available in the quantity you chose.', { fieldErrors: stockErrors });
    }

    if (payment.outcome === 'declined') {
      throw new ApiError('PAYMENT_DECLINED', 'Your card was declined. Try a different card.');
    }

    const prefix = orderNumberPrefix(now);
    const numbers = (db.prepare('SELECT number FROM orders WHERE number LIKE ?').all(`${prefix}%`) as { number: string }[]).map((r) => r.number);
    const number = formatOrderNumber(now, nextSequence(numbers, now));

    const couponCode = priced.totals.coupon?.applied ? priced.totals.coupon.code : null;
    const info = db
      .prepare(
        `INSERT INTO orders (number, user_id, status, created_at, delivery_date, coupon_code, shipping_method,
          subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, payment_last4, address)
         VALUES (?, ?, 'Processing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        number,
        userId,
        now.toISOString(),
        body.deliveryDate as string,
        couponCode,
        method,
        priced.totals.subtotalCents,
        priced.totals.discountCents,
        priced.totals.shippingCents,
        priced.totals.taxCents,
        priced.totals.totalCents,
        payment.last4,
        JSON.stringify(address),
      );
    const orderId = Number(info.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, unit_price_cents, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const takeProductStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    const takeVariantStock = db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ?');
    for (const item of priced.items) {
      insertItem.run(orderId, item.productId, item.variantId, item.name, item.variantLabel, item.unitPriceCents, item.quantity);
      if (item.variantId !== null) takeVariantStock.run(item.quantity, item.variantId);
      takeProductStock.run(item.quantity, item.productId);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM carts WHERE user_id = ?').run(userId);
    return orderId;
  });

  const orderId = place();
  const order = getOrderForUser(db, userId, orderId);
  if (!order) throw new ApiError('INTERNAL_ERROR', 'The order was saved but could not be loaded.');
  return { order };
}

export interface OrderSummary {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  deliveryDate: string;
  itemCount: number;
  totalCents: number;
}

/** The user's own orders, filtered by status, sorted and paged. A page past the end is an empty list. */
export function listOrdersForUser(db: Db, userId: number, query: OrderListQuery): ListResult<OrderSummary> {
  const where = query.status ? 'o.user_id = ? AND o.status = ?' : 'o.user_id = ?';
  const params: (string | number)[] = query.status ? [userId, query.status] : [userId];
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE ${where}`).get(...params) as { n: number };
  const rows = db
    .prepare(
      `SELECT o.id, o.number, o.status, o.created_at, o.delivery_date, o.total_cents,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o WHERE ${where} ORDER BY ${ORDER_SORT_SQL[query.sort]} LIMIT ? OFFSET ?`,
    )
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as {
    id: number;
    number: string;
    status: string;
    created_at: string;
    delivery_date: string;
    total_cents: number;
    item_count: number;
  }[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      createdAt: r.created_at,
      deliveryDate: r.delivery_date,
      itemCount: r.item_count,
      totalCents: r.total_cents,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: n,
  };
}

/**
 * Cancels one of the user's orders. Only a Processing order can be cancelled (409 otherwise); an order that
 * is not the user's looks like a missing one (404). The status change and the stock restore (product stock,
 * plus variant stock for lines with a variant) happen in one transaction.
 */
export function cancelOrder(db: Db, userId: number, orderId: number): OrderView {
  const run = db.transaction((): void => {
    const row = db.prepare('SELECT id, status FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId) as
      | { id: number; status: string }
      | undefined;
    if (!row) throw new ApiError('NOT_FOUND', 'Order not found.');
    if (row.status !== 'Processing') {
      throw new ApiError('CONFLICT', `This order is ${row.status} and can no longer be cancelled. Only Processing orders can be cancelled.`);
    }
    db.prepare("UPDATE orders SET status = 'Cancelled' WHERE id = ?").run(orderId);
    const items = db.prepare('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?').all(orderId) as {
      product_id: number;
      variant_id: number | null;
      quantity: number;
    }[];
    const giveProductStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    const giveVariantStock = db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?');
    for (const item of items) {
      if (item.variant_id !== null) giveVariantStock.run(item.quantity, item.variant_id);
      giveProductStock.run(item.quantity, item.product_id);
    }
  });
  run();
  return getOrderForUser(db, userId, orderId)!;
}
