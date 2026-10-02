import type { Database } from 'better-sqlite3';

/** Tables in dependency order: children come after the tables they reference. */
export const TABLES_IN_CREATE_ORDER = [
  'users',
  'sessions',
  'countries',
  'regions',
  'coupons',
  'products',
  'product_variants',
  'reviews',
  'addresses',
  'wishlist_items',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'contact_messages',
] as const;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
  locked        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS countries (
  code           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  postal_pattern TEXT NOT NULL,
  postal_hint    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id           INTEGER PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  UNIQUE (country_code, code)
);

CREATE TABLE IF NOT EXISTS coupons (
  code                TEXT PRIMARY KEY,
  kind                TEXT NOT NULL CHECK (kind IN ('percent', 'fixed', 'free_shipping')),
  value               INTEGER NOT NULL,
  min_subtotal_cents  INTEGER NOT NULL DEFAULT 0,
  once_per_account    INTEGER NOT NULL DEFAULT 0,
  expires_at          TEXT,
  description         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  subcategory      TEXT NOT NULL,
  description      TEXT NOT NULL,
  specs            TEXT NOT NULL,
  price_cents      INTEGER NOT NULL,
  sale_price_cents INTEGER,
  stock            INTEGER NOT NULL DEFAULT 0,
  featured         INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  image_count      INTEGER NOT NULL DEFAULT 1,
  image_path       TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size       TEXT,
  colour     TEXT,
  stock      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  image_path  TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  street       TEXT NOT NULL,
  city         TEXT NOT NULL,
  region_code  TEXT NOT NULL,
  country_code TEXT NOT NULL REFERENCES countries(code),
  postal_code  TEXT NOT NULL,
  phone        TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS carts (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coupon_code TEXT
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_line ON cart_items(user_id, product_id, COALESCE(variant_id, 0));

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY,
  number           TEXT NOT NULL UNIQUE,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL CHECK (status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled')),
  created_at       TEXT NOT NULL,
  delivery_date    TEXT NOT NULL,
  coupon_code      TEXT,
  shipping_method  TEXT NOT NULL CHECK (shipping_method IN ('standard', 'express')),
  subtotal_cents   INTEGER NOT NULL,
  discount_cents   INTEGER NOT NULL,
  shipping_cents   INTEGER NOT NULL,
  tax_cents        INTEGER NOT NULL,
  total_cents      INTEGER NOT NULL,
  payment_last4    TEXT NOT NULL,
  address          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL,
  variant_id       INTEGER,
  name             TEXT NOT NULL,
  variant_label    TEXT,
  unit_price_cents INTEGER NOT NULL,
  quantity         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  topic      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

export function createSchema(db: Database): void {
  db.exec(SCHEMA);
}

/** Removes every table so a stale file from an older version cannot leak in. */
export function dropAllTables(db: Database): void {
  db.pragma('foreign_keys = OFF');
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  for (const { name } of rows) db.exec(`DROP TABLE IF EXISTS "${name}"`);
  db.pragma('foreign_keys = ON');
}
