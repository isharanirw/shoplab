import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from './connection';
import type { Db } from './connection';
import { seedDatabase } from './seed';
import { TABLES_IN_CREATE_ORDER } from './schema';

const seedDir = loadConfig().seedDir;
let db: Db;

function dump(): string {
  return JSON.stringify(
    TABLES_IN_CREATE_ORDER.filter((t) => t !== 'sessions').map((t) =>
      db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all(),
    ),
  );
}
const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, seedDir);
});

describe('seed determinism', () => {
  it('produces identical data after a reset, twice', () => {
    const first = dump();
    seedDatabase(db, seedDir);
    expect(dump()).toBe(first);
    seedDatabase(db, seedDir);
    expect(dump()).toBe(first);
  });

  it('discards changes made between resets', () => {
    const first = dump();
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role, locked, created_at) VALUES ('x', 'x@x.test', 'h', 'customer', 0, 'now')",
    ).run();
    db.prepare('UPDATE products SET stock = 99 WHERE id = 7').run();
    db.prepare('DELETE FROM wishlist_items').run();
    seedDatabase(db, seedDir);
    expect(dump()).toBe(first);
  });

  it('clears sessions on reset', () => {
    db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ('s', 1, 'a', 'b')").run();
    seedDatabase(db, seedDir);
    expect(count('SELECT COUNT(*) AS n FROM sessions')).toBe(0);
  });
});

describe('default seed contents', () => {
  it('has the four accounts with fixed ids and working bcrypt hashes', () => {
    const rows = db.prepare('SELECT id, email, role, locked, password_hash FROM users ORDER BY id').all() as {
      id: number;
      email: string;
      role: string;
      locked: number;
      password_hash: string;
    }[];
    expect(rows.map((r) => [r.id, r.email, r.role, r.locked])).toEqual([
      [1, 'customer1@shoplab.test', 'customer', 0],
      [2, 'customer2@shoplab.test', 'customer', 0],
      [3, 'locked@shoplab.test', 'customer', 1],
      [4, 'admin@shoplab.test', 'admin', 0],
    ]);
    expect(bcrypt.compareSync('Test@1234', rows[0]!.password_hash)).toBe(true);
    expect(bcrypt.compareSync('Test@1234', rows[2]!.password_hash)).toBe(true);
    expect(bcrypt.compareSync('Admin@1234', rows[3]!.password_hash)).toBe(true);
    expect(bcrypt.compareSync('Test@1234', rows[3]!.password_hash)).toBe(false);
  });

  it('has 60 products with ids 1 to 60 in six categories priced $5 to $499', () => {
    expect(count('SELECT COUNT(*) AS n FROM products')).toBe(60);
    expect(count('SELECT MIN(id) AS n FROM products')).toBe(1);
    expect(count('SELECT MAX(id) AS n FROM products')).toBe(60);
    expect(count('SELECT COUNT(DISTINCT category) AS n FROM products')).toBe(6);
    expect(count('SELECT MIN(price_cents) AS n FROM products')).toBe(500);
    expect(count('SELECT MAX(price_cents) AS n FROM products')).toBe(49900);
  });

  it('covers the catalogue special cases', () => {
    expect(count('SELECT COUNT(*) AS n FROM products WHERE stock = 0')).toBeGreaterThanOrEqual(5);
    expect(count('SELECT COUNT(*) AS n FROM products WHERE stock BETWEEN 1 AND 3')).toBeGreaterThanOrEqual(5);
    expect(count('SELECT COUNT(*) AS n FROM products WHERE sale_price_cents IS NOT NULL')).toBeGreaterThanOrEqual(8);
    expect(count('SELECT COUNT(DISTINCT product_id) AS n FROM product_variants')).toBeGreaterThanOrEqual(10);
    expect(count('SELECT COUNT(*) AS n FROM products WHERE length(name) > 100')).toBeGreaterThanOrEqual(3);
    expect(
      count('SELECT COUNT(*) AS n FROM (SELECT name FROM products GROUP BY name HAVING COUNT(DISTINCT category) > 1)'),
    ).toBeGreaterThanOrEqual(1);
    expect(
      count('SELECT COUNT(*) AS n FROM products p WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = p.id)'),
    ).toBe(1);
    expect(
      count('SELECT COUNT(*) AS n FROM (SELECT product_id FROM reviews GROUP BY product_id HAVING COUNT(*) >= 25)'),
    ).toBeGreaterThanOrEqual(1);
  });

  it('keeps product stock equal to the sum of its variants', () => {
    const mismatches = count(
      `SELECT COUNT(*) AS n FROM products p WHERE EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
         AND p.stock != (SELECT SUM(stock) FROM product_variants v WHERE v.product_id = p.id)`,
    );
    expect(mismatches).toBe(0);
  });

  it('has the five coupons and three countries with at least three regions each', () => {
    const codes = (db.prepare('SELECT code FROM coupons ORDER BY code').all() as { code: string }[]).map((r) => r.code);
    expect(codes).toEqual(['EXPIRED20', 'FREESHIP', 'MIN100', 'ONCE5', 'SAVE10']);
    expect(count('SELECT COUNT(*) AS n FROM countries')).toBe(3);
    expect(count('SELECT MIN(c) AS n FROM (SELECT COUNT(*) AS c FROM regions GROUP BY country_code)')).toBeGreaterThanOrEqual(3);
  });

  it('gives customer1 3 orders, 2 wishlist items and 2 addresses, and customer2 nothing', () => {
    expect(count('SELECT COUNT(*) AS n FROM orders WHERE user_id = 1')).toBe(3);
    expect(count('SELECT COUNT(*) AS n FROM wishlist_items WHERE user_id = 1')).toBe(2);
    expect(count('SELECT COUNT(*) AS n FROM addresses WHERE user_id = 1')).toBe(2);
    expect(count('SELECT COUNT(*) AS n FROM addresses WHERE user_id = 1 AND is_default = 1')).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM orders WHERE user_id = 2')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM wishlist_items WHERE user_id = 2')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM addresses WHERE user_id = 2')).toBe(0);
  });

  it('has seeded orders whose totals follow the pricing rules', () => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY id').all() as {
      id: number;
      subtotal_cents: number;
      discount_cents: number;
      shipping_cents: number;
      tax_cents: number;
      total_cents: number;
    }[];
    for (const o of orders) {
      expect(o.total_cents).toBe(o.subtotal_cents - o.discount_cents + o.shipping_cents + o.tax_cents);
      expect(o.tax_cents).toBe(Math.floor(((o.subtotal_cents - o.discount_cents) * 10 + 50) / 100));
    }
    const itemSums = db
      .prepare('SELECT order_id, SUM(unit_price_cents * quantity) AS s FROM order_items GROUP BY order_id')
      .all() as { order_id: number; s: number }[];
    const byId = new Map(orders.map((o) => [o.id, o]));
    for (const row of itemSums) expect(row.s).toBe(byId.get(row.order_id)!.subtotal_cents);
  });
});

describe('scenarios', () => {
  it('empty-store keeps accounts but removes the catalogue and orders', () => {
    seedDatabase(db, seedDir, 'empty-store');
    expect(count('SELECT COUNT(*) AS n FROM users')).toBe(4);
    expect(count('SELECT COUNT(*) AS n FROM products')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM orders')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM coupons')).toBe(5);
  });

  it('low-stock leaves every in-stock item with 1 to 3 units and keeps sold-out items sold out', () => {
    seedDatabase(db, seedDir, 'low-stock');
    expect(count('SELECT COUNT(*) AS n FROM products WHERE stock = 0')).toBe(6);
    expect(
      count(
        'SELECT COUNT(*) AS n FROM products p WHERE stock > 3 AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)',
      ),
    ).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM product_variants WHERE stock > 3')).toBe(0);
  });

  it('many-orders gives customer1 50 orders with unique numbers', () => {
    seedDatabase(db, seedDir, 'many-orders');
    expect(count('SELECT COUNT(*) AS n FROM orders WHERE user_id = 1')).toBe(50);
    expect(count('SELECT COUNT(DISTINCT number) AS n FROM orders')).toBe(50);
  });

  it('returns to the default seed after a scenario', () => {
    const first = dump();
    seedDatabase(db, seedDir, 'many-orders');
    seedDatabase(db, seedDir, 'default');
    expect(dump()).toBe(first);
  });
});
