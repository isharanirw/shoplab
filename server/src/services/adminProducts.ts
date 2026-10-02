import type { Db } from '../db/connection';
import type { AdminProductQuery } from '../lib/adminQuery';
import { ApiError } from '../lib/errors';
import { checkImage } from '../lib/imageUpload';
import type { ImageType } from '../lib/imageUpload';
import { parseProductCreate, parseProductPatch } from '../lib/productRules';
import type { ListResult } from './catalogue';
import { deleteProductImage, deleteReviewImage, saveProductImage } from './uploads';

export interface AdminProduct {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  active: boolean;
  featured: boolean;
  hasVariants: boolean;
  imageCount: number;
  imagePath: string | null;
  createdAt: string;
}

interface Row {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  price_cents: number;
  sale_price_cents: number | null;
  stock: number;
  active: number;
  featured: number;
  image_count: number;
  image_path: string | null;
  created_at: string;
  has_variants: number;
}

const COLUMNS = `p.id, p.name, p.category, p.subcategory, p.description, p.price_cents, p.sale_price_cents, p.stock,
  p.active, p.featured, p.image_count, p.image_path, p.created_at,
  EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) AS has_variants`;

function toProduct(row: Row): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    description: row.description,
    priceCents: row.price_cents,
    salePriceCents: row.sale_price_cents,
    stock: row.stock,
    active: row.active === 1,
    featured: row.featured === 1,
    hasVariants: row.has_variants === 1,
    imageCount: row.image_count,
    imagePath: row.image_path,
    createdAt: row.created_at,
  };
}

export function getAdminProduct(db: Db, id: number): AdminProduct | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM products p WHERE p.id = ?`).get(id) as Row | undefined;
  return row ? toProduct(row) : null;
}

/** Every product, active or not, filtered by name text and active flag, in ID order. A page past the end is an empty list. */
export function listAdminProducts(db: Db, query: AdminProductQuery): ListResult<AdminProduct> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.q !== '') {
    where.push('instr(lower(p.name), lower(?)) > 0');
    params.push(query.q);
  }
  if (query.active !== null) {
    where.push('p.active = ?');
    params.push(query.active ? 1 : 0);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM products p ${whereSql}`).get(...params) as { n: number };
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM products p ${whereSql} ORDER BY p.id ASC LIMIT ? OFFSET ?`)
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as Row[];
  return { data: rows.map(toProduct), page: query.page, pageSize: query.pageSize, total: n };
}

type ImageVerdict = { ok: true; type: ImageType } | { ok: false; message: string } | null;

/** Looks at an upload. Too large is a 413 straight away; a wrong type is returned so it can be reported with the field errors. */
function judgeImage(image: Buffer | null): ImageVerdict {
  if (!image) return null;
  const check = checkImage(image);
  if (check.ok) return { ok: true, type: check.type };
  if (check.reason === 'too_large') {
    throw new ApiError('PAYLOAD_TOO_LARGE', check.message, { fieldErrors: { image: check.message } });
  }
  return { ok: false, message: check.message };
}

/** Runs the field rules and adds an image problem to whatever they report, so everything comes back in one 400. */
function validateWithImage<T>(verdict: ImageVerdict, rules: () => T): { value: T; imageType: ImageType | null } {
  const imageError = verdict && !verdict.ok ? verdict.message : null;
  let value: T;
  try {
    value = rules();
  } catch (err) {
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && imageError) {
      throw new ApiError('VALIDATION_ERROR', err.message, { fieldErrors: { ...err.fieldErrors, image: imageError } });
    }
    throw err;
  }
  if (imageError) {
    throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors: { image: imageError } });
  }
  return { value, imageType: verdict && verdict.ok ? verdict.type : null };
}

/**
 * Creates a product from a request body. Every field problem and an unusable image come back together as one
 * 400; an image over 2 MB is a 413. The file is only written once everything passed. The new ID is one more than
 * the highest ID ever used, so the first product after a reset is 61 and an ID is never reused.
 */
export function createProduct(
  db: Db,
  uploadsDir: string,
  rawFields: Record<string, unknown>,
  image: Buffer | null,
  now: Date = new Date(),
): AdminProduct {
  const { value: input, imageType } = validateWithImage(judgeImage(image), () => parseProductCreate(rawFields));
  const imagePath = image && imageType ? saveProductImage(uploadsDir, image, imageType) : null;
  try {
    const info = db
      .prepare(
        `INSERT INTO products (name, category, subcategory, description, specs, price_cents, sale_price_cents, stock,
          featured, active, image_count, image_path, created_at) VALUES (?, ?, ?, ?, '[]', ?, ?, ?, 0, ?, 1, ?, ?)`,
      )
      .run(
        input.name,
        input.category,
        input.subcategory,
        input.description,
        input.priceCents,
        input.salePriceCents,
        input.stock,
        input.active ? 1 : 0,
        imagePath,
        now.toISOString(),
      );
    return getAdminProduct(db, Number(info.lastInsertRowid))!;
  } catch (err) {
    deleteProductImage(uploadsDir, imagePath);
    throw err;
  }
}

/**
 * Changes a product (404 when it does not exist). The fields are validated against the stored product; a new
 * image replaces the old file, and `removeImage: true` drops the image so the placeholder shows again.
 */
export function updateProduct(
  db: Db,
  uploadsDir: string,
  id: number,
  rawFields: Record<string, unknown>,
  image: Buffer | null,
): AdminProduct {
  const current = getAdminProduct(db, id);
  if (!current) throw new ApiError('NOT_FOUND', 'Product not found.');
  const { value: patch, imageType } = validateWithImage(judgeImage(image), () => parseProductPatch(rawFields, current, image !== null));

  const newImagePath = image && imageType ? saveProductImage(uploadsDir, image, imageType) : null;
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const set = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };
  if (patch.name !== undefined) set('name', patch.name);
  if (patch.category !== undefined) set('category', patch.category);
  if (patch.subcategory !== undefined) set('subcategory', patch.subcategory);
  if (patch.description !== undefined) set('description', patch.description);
  if (patch.priceCents !== undefined) set('price_cents', patch.priceCents);
  if (patch.salePriceCents !== undefined) set('sale_price_cents', patch.salePriceCents);
  if (patch.stock !== undefined) set('stock', patch.stock);
  if (patch.active !== undefined) set('active', patch.active ? 1 : 0);
  if (newImagePath) set('image_path', newImagePath);
  else if (patch.removeImage === true) set('image_path', null);

  try {
    if (sets.length > 0) db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  } catch (err) {
    deleteProductImage(uploadsDir, newImagePath);
    throw err;
  }
  if (newImagePath || patch.removeImage === true) deleteProductImage(uploadsDir, current.imagePath);
  return getAdminProduct(db, id)!;
}

/**
 * Deletes a product for good (404 when it does not exist). The product, its variants, reviews, cart lines and
 * wishlist entries go with it. Past orders keep their own copy of each line (name, price, quantity), so order
 * history still renders; those lines simply no longer link to a live product.
 */
export function deleteProduct(db: Db, uploadsDir: string, id: number): void {
  const current = getAdminProduct(db, id);
  if (!current) throw new ApiError('NOT_FOUND', 'Product not found.');
  const reviewImages = (
    db.prepare('SELECT image_path FROM reviews WHERE product_id = ? AND image_path IS NOT NULL').all(id) as { image_path: string }[]
  ).map((r) => r.image_path);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  deleteProductImage(uploadsDir, current.imagePath);
  for (const path of reviewImages) deleteReviewImage(uploadsDir, path);
}
