import type { Db } from '../db/connection';
import type { CategoryInfo, ProductQuery, ReviewQuery } from '../lib/catalogueQuery';
import { f01, f11, f20 } from '../testability/variants';

export interface ListResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RatingSummary {
  /** Average rounded half up to one decimal; null when there are no reviews. */
  average: number | null;
  count: number;
}

export interface ProductSummary {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  inStock: boolean;
  hasVariants: boolean;
  featured: boolean;
  imageCount: number;
  /** URL path of an image uploaded by an admin, or null (the generated placeholder is used then). */
  imagePath: string | null;
  rating: RatingSummary;
  createdAt: string;
}

export interface Variant {
  id: number;
  size: string | null;
  colour: string | null;
  stock: number;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  specs: { label: string; value: string }[];
  variants: Variant[];
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface Review {
  id: number;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  imagePath: string | null;
  createdAt: string;
}

export interface Suggestion {
  id: number;
  name: string;
  category: string;
}

export interface CategoryNode {
  name: string;
  productCount: number;
  subcategories: { name: string; productCount: number }[];
}

export const SUGGEST_LIMIT = 5;
export const SUGGEST_MIN_CHARS = 2;

/** Storefront order for the six seeded categories; anything else follows alphabetically. */
const CATEGORY_ORDER = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books', 'Toys'];

/**
 * Per-product review aggregate. The average is held as integer tenths, rounded half up
 * ((20 * sum + n) / (2 * n) in integer maths), so the rating filter and sort use the same
 * number the cards display.
 */
export const SUMMARY_FROM = `
  FROM products p
  LEFT JOIN (
    SELECT product_id,
           COUNT(*) AS review_count,
           (SUM(rating) * 20 + COUNT(*)) / (2 * COUNT(*)) AS rating_tenths
    FROM reviews GROUP BY product_id
  ) r ON r.product_id = p.id`;

export const SUMMARY_COLUMNS = `
  p.id, p.name, p.category, p.subcategory, p.price_cents, p.sale_price_cents, p.stock, p.featured,
  p.image_count, p.image_path, p.created_at,
  COALESCE(r.review_count, 0) AS review_count,
  r.rating_tenths AS rating_tenths,
  EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) AS has_variants`;

export interface SummaryRow {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  price_cents: number;
  sale_price_cents: number | null;
  stock: number;
  featured: number;
  image_count: number;
  image_path: string | null;
  created_at: string;
  review_count: number;
  rating_tenths: number | null;
  has_variants: number;
}

export function mapSummary(row: SummaryRow): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    priceCents: row.price_cents,
    salePriceCents: row.sale_price_cents,
    stock: row.stock,
    inStock: row.stock > 0,
    hasVariants: row.has_variants === 1,
    featured: row.featured === 1,
    imageCount: row.image_count,
    imagePath: row.image_path,
    rating: {
      average: row.rating_tenths === null ? null : row.rating_tenths / 10,
      count: row.review_count,
    },
    createdAt: row.created_at,
  };
}

const EFFECTIVE_PRICE = 'COALESCE(p.sale_price_cents, p.price_cents)';

const PRODUCT_ORDER: Record<string, string> = {
  price_asc: `${EFFECTIVE_PRICE} ASC, p.id ASC`,
  price_desc: `${EFFECTIVE_PRICE} DESC, p.id ASC`,
  // Unrated products sort last; ties go to the product with more reviews, then the lower ID.
  rating: 'COALESCE(r.rating_tenths, -1) DESC, COALESCE(r.review_count, 0) DESC, p.id ASC',
  newest: 'p.created_at DESC, p.id DESC',
};

export function listCategories(db: Db): CategoryNode[] {
  const rows = db
    .prepare('SELECT category, subcategory, COUNT(*) AS n FROM products WHERE active = 1 GROUP BY category, subcategory')
    .all() as { category: string; subcategory: string; n: number }[];
  const byName = new Map<string, CategoryNode>();
  for (const row of rows) {
    let node = byName.get(row.category);
    if (!node) {
      node = { name: row.category, productCount: 0, subcategories: [] };
      byName.set(row.category, node);
    }
    node.productCount += row.n;
    node.subcategories.push({ name: row.subcategory, productCount: row.n });
  }
  const rank = (name: string) => {
    const i = CATEGORY_ORDER.indexOf(name);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  const nodes = [...byName.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  for (const node of nodes) node.subcategories.sort((a, b) => a.name.localeCompare(b.name));
  return nodes;
}

export function categoryInfo(db: Db): CategoryInfo[] {
  return listCategories(db).map((c) => ({ name: c.name, subcategories: c.subcategories.map((s) => s.name) }));
}

export function listProducts(db: Db, query: ProductQuery): ListResult<ProductSummary> {
  const where: string[] = ['p.active = 1'];
  const params: (string | number)[] = [];

  if (query.q !== '') {
    where.push(`${f11('p.name', '?')} > 0`);
    params.push(query.q);
  }
  if (query.categories.length > 0) {
    where.push(`p.category IN (${query.categories.map(() => '?').join(', ')})`);
    params.push(...query.categories);
  }
  if (query.subcategory !== null) {
    where.push('p.subcategory = ?');
    params.push(query.subcategory);
  }
  if (query.minPriceCents !== null) {
    where.push(`${EFFECTIVE_PRICE} >= ?`);
    params.push(query.minPriceCents);
  }
  if (query.maxPriceCents !== null) {
    where.push(`${EFFECTIVE_PRICE} ${f01('<=')} ?`);
    params.push(query.maxPriceCents);
  }
  if (query.inStock) where.push('p.stock > 0');
  if (query.featured) where.push('p.featured = 1');
  if (query.minRating !== null) {
    where.push('r.rating_tenths >= ?');
    params.push(query.minRating * 10);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderSql = query.sort ? PRODUCT_ORDER[query.sort] : 'p.id ASC';

  const total = (db.prepare(`SELECT COUNT(*) AS n ${SUMMARY_FROM} ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT ${SUMMARY_COLUMNS} ${SUMMARY_FROM} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as SummaryRow[];

  return { data: rows.map(mapSummary), page: query.page, pageSize: query.pageSize, total };
}

/** Name matches that start with the text come first, then other substring matches, each by ID. */
export function suggestProducts(db: Db, text: string): ListResult<Suggestion> {
  const q = text.trim();
  if (q.length < SUGGEST_MIN_CHARS) return { data: [], page: 1, pageSize: SUGGEST_LIMIT, total: 0 };
  const where = 'WHERE active = 1 AND instr(lower(name), lower(?)) > 0';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM products ${where}`).get(q) as { n: number }).n;
  const data = db
    .prepare(
      `SELECT id, name, category FROM products ${where}
       ORDER BY CASE WHEN instr(lower(name), lower(?)) = 1 THEN 0 ELSE 1 END, id ASC LIMIT ?`,
    )
    .all(q, q, SUGGEST_LIMIT) as Suggestion[];
  return { data, page: 1, pageSize: SUGGEST_LIMIT, total };
}

export function getProduct(db: Db, id: number): ProductDetail | null {
  const row = db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS}, p.description, p.specs ${SUMMARY_FROM} WHERE p.id = ? AND p.active = 1`,
    )
    .get(id) as (SummaryRow & { description: string; specs: string }) | undefined;
  if (!row) return null;

  const variants = db
    .prepare('SELECT id, size, colour, stock FROM product_variants WHERE product_id = ? ORDER BY id')
    .all(id) as Variant[];
  const distribution: ProductDetail['ratingDistribution'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const counts = db
    .prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? GROUP BY rating')
    .all(id) as { rating: number; n: number }[];
  for (const c of counts) distribution[String(c.rating) as keyof typeof distribution] = c.n;

  return {
    ...mapSummary(row),
    description: row.description,
    specs: JSON.parse(row.specs) as ProductDetail['specs'],
    variants,
    ratingDistribution: distribution,
  };
}

const REVIEW_ORDER: Record<string, string> = {
  newest: 'created_at DESC, id DESC',
  highest: 'rating DESC, created_at DESC, id DESC',
  lowest: 'rating ASC, created_at DESC, id DESC',
};

/** Returns null when the product does not exist. */
export function listReviews(db: Db, productId: number, query: ReviewQuery): ListResult<Review> | null {
  const exists = db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(productId);
  if (!exists) return null;
  const total = (db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE product_id = ?').get(productId) as { n: number }).n;
  const rows = db
    .prepare(
      `SELECT id, author_name, rating, title, body, image_path, created_at FROM reviews
       WHERE product_id = ? ORDER BY ${REVIEW_ORDER[query.sort]} LIMIT ? OFFSET ?`,
    )
    .all(productId, query.pageSize, f20((query.page - 1) * query.pageSize)) as {
    id: number;
    author_name: string;
    rating: number;
    title: string;
    body: string;
    image_path: string | null;
    created_at: string;
  }[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      rating: r.rating,
      title: r.title,
      body: r.body,
      imagePath: r.image_path,
      createdAt: r.created_at,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}
