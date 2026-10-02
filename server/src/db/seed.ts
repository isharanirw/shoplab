import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './connection';

export const SCENARIOS = ['default', 'empty-store', 'low-stock', 'many-orders'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function isScenario(value: unknown): value is Scenario {
  return typeof value === 'string' && (SCENARIOS as readonly string[]).includes(value);
}

interface SeedUser { id: number; name: string; email: string; passwordHash: string; role: string; locked: number; createdAt: string }
interface SeedProduct {
  id: number; name: string; category: string; subcategory: string; description: string;
  specs: { label: string; value: string }[]; priceCents: number; salePriceCents: number | null;
  stock: number; featured: number; active: number; imageCount: number; createdAt: string;
}
interface SeedVariant { id: number; productId: number; size: string | null; colour: string | null; stock: number }
interface SeedReview {
  id: number; productId: number; userId: number | null; authorName: string; rating: number;
  title: string; body: string; imagePath: string | null; createdAt: string;
}
interface SeedCoupon {
  code: string; kind: string; value: number; minSubtotalCents: number; oncePerAccount: number;
  expiresAt: string | null; description: string;
}
interface SeedCountry {
  code: string; name: string; postalPattern: string; postalHint: string; regions: { code: string; name: string }[];
}
interface SeedAddress {
  id: number; userId: number; label: string; firstName: string; lastName: string; street: string; city: string;
  regionCode: string; countryCode: string; postalCode: string; phone: string; isDefault: number;
}
interface SeedWishlistItem { userId: number; productId: number; position: number; addedAt: string }
interface SeedOrder {
  id: number; number: string; userId: number; status: string; createdAt: string; deliveryDate: string;
  couponCode: string | null; shippingMethod: string; subtotalCents: number; discountCents: number;
  shippingCents: number; taxCents: number; totalCents: number; paymentLast4: string; address: unknown;
  items: {
    productId: number; variantId: number | null; name: string; variantLabel: string | null;
    unitPriceCents: number; quantity: number;
  }[];
}

export interface SeedData {
  users: SeedUser[];
  products: SeedProduct[];
  variants: SeedVariant[];
  reviews: SeedReview[];
  coupons: SeedCoupon[];
  countries: SeedCountry[];
  addresses: SeedAddress[];
  wishlist: SeedWishlistItem[];
  orders: SeedOrder[];
  ordersMany: SeedOrder[];
}

const cache = new Map<string, SeedData>();

export function loadSeedData(seedDir: string): SeedData {
  const cached = cache.get(seedDir);
  if (cached) return cached;
  const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8')) as T;
  const data: SeedData = {
    users: read('users.json'),
    products: read('products.json'),
    variants: read('variants.json'),
    reviews: read('reviews.json'),
    coupons: read('coupons.json'),
    countries: read('countries.json'),
    addresses: read('addresses.json'),
    wishlist: read('wishlist.json'),
    orders: read('orders.json'),
    ordersMany: read('orders-many.json'),
  };
  cache.set(seedDir, data);
  return data;
}

/** Child tables first so foreign keys never block the delete. */
const CLEAR_ORDER = [
  'order_items', 'orders', 'wishlist_items', 'addresses', 'reviews', 'product_variants',
  'products', 'coupons', 'regions', 'countries', 'sessions', 'users',
];

/**
 * Wipes every table and loads the seed for a scenario inside one transaction.
 * Row IDs come from the JSON files, so the result is identical every time.
 */
export function seedDatabase(db: Db, seedDir: string, scenario: Scenario = 'default'): void {
  const data = loadSeedData(seedDir);
  const run = db.transaction(() => {
    for (const table of CLEAR_ORDER) db.exec(`DELETE FROM ${table}`);

    const insUser = db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, locked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const u of data.users) insUser.run(u.id, u.name, u.email, u.passwordHash, u.role, u.locked, u.createdAt);

    const insCountry = db.prepare('INSERT INTO countries (code, name, postal_pattern, postal_hint) VALUES (?, ?, ?, ?)');
    const insRegion = db.prepare('INSERT INTO regions (country_code, code, name) VALUES (?, ?, ?)');
    for (const c of data.countries) {
      insCountry.run(c.code, c.name, c.postalPattern, c.postalHint);
      for (const r of c.regions) insRegion.run(c.code, r.code, r.name);
    }

    const insCoupon = db.prepare(
      'INSERT INTO coupons (code, kind, value, min_subtotal_cents, once_per_account, expires_at, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const c of data.coupons) {
      insCoupon.run(c.code, c.kind, c.value, c.minSubtotalCents, c.oncePerAccount, c.expiresAt, c.description);
    }

    if (scenario === 'empty-store') return;

    const insProduct = db.prepare(
      `INSERT INTO products (id, name, category, subcategory, description, specs, price_cents, sale_price_cents,
        stock, featured, active, image_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const p of data.products) {
      insProduct.run(
        p.id, p.name, p.category, p.subcategory, p.description, JSON.stringify(p.specs), p.priceCents,
        p.salePriceCents, p.stock, p.featured, p.active, p.imageCount, p.createdAt,
      );
    }

    const insVariant = db.prepare(
      'INSERT INTO product_variants (id, product_id, size, colour, stock) VALUES (?, ?, ?, ?, ?)',
    );
    for (const v of data.variants) insVariant.run(v.id, v.productId, v.size, v.colour, v.stock);

    const insReview = db.prepare(
      `INSERT INTO reviews (id, product_id, user_id, author_name, rating, title, body, image_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of data.reviews) {
      insReview.run(r.id, r.productId, r.userId, r.authorName, r.rating, r.title, r.body, r.imagePath, r.createdAt);
    }

    const insAddress = db.prepare(
      `INSERT INTO addresses (id, user_id, label, first_name, last_name, street, city, region_code, country_code,
        postal_code, phone, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const a of data.addresses) {
      insAddress.run(
        a.id, a.userId, a.label, a.firstName, a.lastName, a.street, a.city, a.regionCode, a.countryCode,
        a.postalCode, a.phone, a.isDefault,
      );
    }

    const insWish = db.prepare('INSERT INTO wishlist_items (user_id, product_id, position, added_at) VALUES (?, ?, ?, ?)');
    for (const w of data.wishlist) insWish.run(w.userId, w.productId, w.position, w.addedAt);

    const insOrder = db.prepare(
      `INSERT INTO orders (id, number, user_id, status, created_at, delivery_date, coupon_code, shipping_method,
        subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, payment_last4, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, unit_price_cents, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const orders = scenario === 'many-orders' ? [...data.orders, ...data.ordersMany] : data.orders;
    for (const o of orders) {
      insOrder.run(
        o.id, o.number, o.userId, o.status, o.createdAt, o.deliveryDate, o.couponCode, o.shippingMethod,
        o.subtotalCents, o.discountCents, o.shippingCents, o.taxCents, o.totalCents, o.paymentLast4,
        JSON.stringify(o.address),
      );
      for (const i of o.items) {
        insItem.run(o.id, i.productId, i.variantId, i.name, i.variantLabel, i.unitPriceCents, i.quantity);
      }
    }

    if (scenario === 'low-stock') {
      // Every product that is in stock drops to 1-3 units; sold-out items stay sold out.
      db.exec('UPDATE product_variants SET stock = CASE WHEN stock = 0 THEN 0 ELSE 1 + (id % 3) END');
      db.exec(
        `UPDATE products SET stock = COALESCE(
           (SELECT SUM(stock) FROM product_variants WHERE product_id = products.id),
           CASE WHEN stock = 0 THEN 0 ELSE 1 + (id % 3) END)`,
      );
    }
  });
  run();
}
