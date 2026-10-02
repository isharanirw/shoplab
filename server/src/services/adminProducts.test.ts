import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { parseProductQuery } from '../lib/catalogueQuery';
import { createProduct, deleteProduct, getAdminProduct, listAdminProducts, updateProduct } from './adminProducts';
import { addItem, getCart } from './cart';
import { categoryInfo, getProduct, listProducts, listReviews, suggestProducts } from './catalogue';
import { getOrderForUser } from './orders';
import { productExists } from './reviews';
import { addToWishlist, listWishlist } from './wishlist';
import { TINY_PNG } from '../testing/harness';

const seedDir = loadConfig().seedDir;
let db: Db;
let uploadsDir: string;

const base = { name: 'Desk Lamp', category: 'Home', priceCents: 2500, stock: 5 };
const pageOf = (raw: Record<string, unknown> = {}) => ({ q: '', active: null, page: 1, pageSize: 10, ...raw }) as Parameters<typeof listAdminProducts>[1];

function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, seedDir);
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoplab-admin-products-'));
});

afterEach(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

describe('product IDs', () => {
  it('continue after the seed (61, 62, ...) and are never reused after a delete', () => {
    expect(createProduct(db, uploadsDir, base, null).id).toBe(61);
    expect(createProduct(db, uploadsDir, base, null).id).toBe(62);
    deleteProduct(db, uploadsDir, 62);
    expect(createProduct(db, uploadsDir, base, null).id).toBe(63);
  });

  it('start again at 61 after a reseed, in every scenario', () => {
    createProduct(db, uploadsDir, base, null);
    createProduct(db, uploadsDir, base, null);
    seedDatabase(db, seedDir);
    expect(createProduct(db, uploadsDir, base, null).id).toBe(61);
    seedDatabase(db, seedDir, 'empty-store');
    expect(createProduct(db, uploadsDir, base, null).id).toBe(61);
  });

  it('leave the seed IDs 1 to 60 untouched', () => {
    createProduct(db, uploadsDir, base, null);
    const ids = (db.prepare('SELECT id FROM products ORDER BY id').all() as { id: number }[]).map((r) => r.id);
    expect(ids.slice(0, 60)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });
});

describe('create and read', () => {
  it('stores the product with defaults and returns the admin shape', () => {
    const p = createProduct(db, uploadsDir, { ...base, salePriceCents: 1999 }, null, new Date('2026-10-01T10:00:00Z'));
    expect(p).toEqual({
      id: 61,
      name: 'Desk Lamp',
      category: 'Home',
      subcategory: 'Appliances',
      description: 'No description provided.',
      priceCents: 2500,
      salePriceCents: 1999,
      stock: 5,
      active: true,
      featured: false,
      hasVariants: false,
      imageCount: 1,
      imagePath: null,
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    expect(getAdminProduct(db, 61)).toEqual(p);
  });

  it('rejects invalid input with a 400 and stores nothing', () => {
    const err = failure(() => createProduct(db, uploadsDir, { name: '', category: 'Cars', priceCents: -5, stock: 1.5 }, null));
    expect(err.status).toBe(400);
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(['category', 'name', 'priceCents', 'stock']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM products').get()).toEqual({ n: 60 });
  });

  it('shows a new active product in the public catalogue, search and suggestions', () => {
    createProduct(db, uploadsDir, { ...base, name: 'Zebra Lamp' }, null);
    const query = parseProductQuery({ q: 'zebra' }, categoryInfo(db));
    expect(listProducts(db, query).data.map((p) => p.id)).toEqual([61]);
    expect(suggestProducts(db, 'zebra').data.map((p) => p.id)).toEqual([61]);
    expect(getProduct(db, 61)?.name).toBe('Zebra Lamp');
  });
});

describe('admin list', () => {
  it('lists active and inactive products in ID order with the standard list shape', () => {
    updateProduct(db, uploadsDir, 3, { active: false }, null);
    const res = listAdminProducts(db, pageOf({ pageSize: 5 }));
    expect(res).toMatchObject({ page: 1, pageSize: 5, total: 60 });
    expect(res.data.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(res.data[2]!.active).toBe(false);
  });

  it('searches names ignoring case, filters by active and pages past the end', () => {
    createProduct(db, uploadsDir, { ...base, name: 'Zebra Lamp', active: false }, null);
    expect(listAdminProducts(db, pageOf({ q: 'ZEBRA' })).data.map((p) => p.id)).toEqual([61]);
    expect(listAdminProducts(db, pageOf({ active: false })).data.map((p) => p.id)).toEqual([61]);
    expect(listAdminProducts(db, pageOf({ active: true })).total).toBe(60);
    expect(listAdminProducts(db, pageOf({ page: 99 }))).toEqual({ data: [], page: 99, pageSize: 10, total: 61 });
    expect(listAdminProducts(db, pageOf({ q: 'no such product' })).total).toBe(0);
  });
});

describe('update', () => {
  it('changes only the fields sent and returns the stored product', () => {
    const before = getAdminProduct(db, 1)!;
    const after = updateProduct(db, uploadsDir, 1, { name: 'Renamed', stock: 7 }, null);
    expect(after).toEqual({ ...before, name: 'Renamed', stock: 7 });
  });

  it('is a 404 for an unknown product and a 400 for an empty body', () => {
    expect(failure(() => updateProduct(db, uploadsDir, 999, { name: 'x y' }, null)).status).toBe(404);
    expect(failure(() => updateProduct(db, uploadsDir, 1, {}, null)).fieldErrors?.body).toBeDefined();
  });

  it('keeps the sale price below the price', () => {
    // Product 2 is on sale in the seed.
    const p = getAdminProduct(db, 2)!;
    expect(p.salePriceCents).not.toBeNull();
    expect(failure(() => updateProduct(db, uploadsDir, 2, { priceCents: p.salePriceCents! }, null)).fieldErrors?.salePriceCents).toBeDefined();
    expect(updateProduct(db, uploadsDir, 2, { salePriceCents: null }, null).salePriceCents).toBeNull();
  });

  it('does not allow setting the stock of a product with variants', () => {
    const withVariants = (db.prepare('SELECT product_id AS id FROM product_variants LIMIT 1').get() as { id: number }).id;
    const err = failure(() => updateProduct(db, uploadsDir, withVariants, { stock: 3 }, null));
    expect(err.status).toBe(400);
    expect(err.fieldErrors?.stock).toMatch(/variants/);
  });
});

describe('inactive products', () => {
  const customerQuery = (raw: Record<string, unknown>) => parseProductQuery(raw, categoryInfo(db));

  beforeEach(() => {
    updateProduct(db, uploadsDir, 36, { active: false }, null); // product 36 is on customer1's wishlist
  });

  it('is hidden from the public list, search and suggestions, and the detail is missing', () => {
    expect(listProducts(db, customerQuery({ pageSize: '50' })).data.some((p) => p.id === 36)).toBe(false);
    expect(listProducts(db, customerQuery({})).total).toBe(59);
    const name = getAdminProduct(db, 36)!.name;
    expect(suggestProducts(db, name).data.some((s) => s.id === 36)).toBe(false);
    expect(getProduct(db, 36)).toBeNull();
    expect(listReviews(db, 36, { sort: 'newest', page: 1, pageSize: 5 })).toBeNull();
    expect(productExists(db, 36)).toBe(false);
  });

  it('cannot be added to a cart or a wishlist', () => {
    expect(failure(() => addItem(db, 2, { productId: 36, quantity: 1 })).status).toBe(404);
    expect(addToWishlist(db, 2, 36)).toBe('no-product');
  });

  it('stays in the database for a wishlist but is not shown there', () => {
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([21]);
    updateProduct(db, uploadsDir, 36, { active: true }, null);
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([36, 21]);
  });

  it('shows as out of stock in a cart that already holds it', () => {
    updateProduct(db, uploadsDir, 36, { active: true }, null);
    addItem(db, 1, { productId: 36, quantity: 1 });
    updateProduct(db, uploadsDir, 36, { active: false }, null);
    const line = getCart(db, 1).items[0]!;
    expect(line).toMatchObject({ productId: 36, inStock: false, stock: 0 });
  });
});

describe('delete', () => {
  it('is a 404 for an unknown product', () => {
    expect(failure(() => deleteProduct(db, uploadsDir, 999)).status).toBe(404);
  });

  it('removes the product with its reviews, wishlist entries and cart lines, but keeps order history intact', () => {
    // Product 36: on customer1's wishlist. Product 15 is in customer1's Shipped order (check below).
    const orderLines = db.prepare('SELECT order_id, product_id, name, unit_price_cents, quantity FROM order_items').all() as {
      order_id: number;
      product_id: number;
      name: string;
      unit_price_cents: number;
      quantity: number;
    }[];
    const inOrder = orderLines[0]!;
    addItem(db, 2, { productId: inOrder.product_id, quantity: 1, ...(variantFor(inOrder.product_id)) });
    expect(listWishlist(db, 1).data.length).toBe(2);

    const orderBefore = getOrderForUser(db, 1, inOrder.order_id)!;
    deleteProduct(db, uploadsDir, inOrder.product_id);

    expect(getAdminProduct(db, inOrder.product_id)).toBeNull();
    expect(getProduct(db, inOrder.product_id)).toBeNull();
    expect(getCart(db, 2).items).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE product_id = ?').get(inOrder.product_id)).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?').get(inOrder.product_id)).toEqual({ n: 0 });
    // The order still renders with the same lines and totals.
    expect(getOrderForUser(db, 1, inOrder.order_id)).toEqual(orderBefore);
  });

  it('removes a deleted product from wishlists', () => {
    deleteProduct(db, uploadsDir, 36);
    expect(listWishlist(db, 1).data.map((i) => i.id)).toEqual([21]);
  });
});

describe('images', () => {
  const upload = (id: number) => (getAdminProduct(db, id)!.imagePath ?? '').replace('/uploads/products/', '');
  const filesOnDisk = () => (fs.existsSync(path.join(uploadsDir, 'products')) ? fs.readdirSync(path.join(uploadsDir, 'products')) : []);

  it('saves a PNG by its content, under a generated name, and exposes the URL path', () => {
    const p = createProduct(db, uploadsDir, base, TINY_PNG);
    expect(p.imagePath).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);
    expect(filesOnDisk()).toEqual([upload(p.id)]);
  });

  it('rejects a file that is not a PNG or JPEG (400 with the field errors) and writes nothing', () => {
    const err = failure(() => createProduct(db, uploadsDir, { ...base, priceCents: 0 }, Buffer.from('not an image')));
    expect(err.status).toBe(400);
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(['image', 'priceCents']);
    expect(filesOnDisk()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM products').get()).toEqual({ n: 60 });
  });

  it('rejects an image over 2 MB with a 413', () => {
    const big = Buffer.concat([TINY_PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const err = failure(() => createProduct(db, uploadsDir, base, big));
    expect(err.status).toBe(413);
    expect(err.fieldErrors?.image).toBeDefined();
    expect(filesOnDisk()).toEqual([]);
  });

  it('replaces the old file on update and removes it on removeImage and on delete', () => {
    const p = createProduct(db, uploadsDir, base, TINY_PNG);
    const first = upload(p.id);
    updateProduct(db, uploadsDir, p.id, {}, TINY_PNG);
    expect(filesOnDisk()).toHaveLength(1);
    expect(filesOnDisk()[0]).not.toBe(first);

    updateProduct(db, uploadsDir, p.id, { removeImage: true }, null);
    expect(getAdminProduct(db, p.id)!.imagePath).toBeNull();
    expect(filesOnDisk()).toEqual([]);

    updateProduct(db, uploadsDir, p.id, {}, TINY_PNG);
    expect(filesOnDisk()).toHaveLength(1);
    deleteProduct(db, uploadsDir, p.id);
    expect(filesOnDisk()).toEqual([]);
  });

  it('reports the uploaded image on the public product', () => {
    const p = createProduct(db, uploadsDir, base, TINY_PNG);
    expect(getProduct(db, p.id)?.imagePath).toBe(p.imagePath);
    expect(getProduct(db, 1)?.imagePath).toBeNull();
  });
});

function variantFor(productId: number): { variantId?: number } {
  const row = db.prepare('SELECT id FROM product_variants WHERE product_id = ? AND stock > 0 ORDER BY id LIMIT 1').get(productId) as
    | { id: number }
    | undefined;
  return row ? { variantId: row.id } : {};
}
