import { ApiError } from './errors';
import { CATEGORY_NAMES, defaultSubcategory, findCategory, findSubcategory } from './taxonomy';

export const NAME_MIN = 2;
export const NAME_MAX = 150;
export const DESCRIPTION_MAX = 2000;
export const PRICE_MIN_CENTS = 1; // $0.01
export const PRICE_MAX_CENTS = 1_000_000; // $10,000.00
export const STOCK_MAX = 10_000;
export const EMPTY_DESCRIPTION = 'No description provided.';

/** A fully validated product, ready to store. */
export interface ProductInput {
  name: string;
  category: string;
  subcategory: string;
  description: string;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  active: boolean;
}

/** What PATCH may change. A missing key means "leave as it is"; `salePriceCents: null` removes the sale price. */
export type ProductPatch = Partial<ProductInput> & { removeImage?: boolean };

/** What the rules need to know about the stored product when validating a PATCH. */
export interface CurrentProduct {
  category: string;
  subcategory: string;
  priceCents: number;
  salePriceCents: number | null;
  hasVariants: boolean;
}

type Raw = Record<string, unknown>;
type Errors = Record<string, string>;

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PRICE_RANGE = `between ${money(PRICE_MIN_CENTS)} and ${money(PRICE_MAX_CENTS)}`;

function checkName(value: unknown, errors: Errors): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.name = 'Name is required.';
    return undefined;
  }
  const name = value.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.name = `Name must be ${NAME_MIN} to ${NAME_MAX} characters.`;
    return undefined;
  }
  return name;
}

function checkCategory(value: unknown, errors: Errors): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.category = 'Category is required.';
    return undefined;
  }
  const category = findCategory(value);
  if (!category) {
    errors.category = `Unknown category. Use one of: ${CATEGORY_NAMES.join(', ')}.`;
    return undefined;
  }
  return category;
}

function checkDescription(value: unknown, errors: Errors): string | undefined {
  if (typeof value !== 'string') {
    errors.description = 'Description must be text.';
    return undefined;
  }
  const text = value.trim();
  if (text.length > DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
    return undefined;
  }
  return text === '' ? EMPTY_DESCRIPTION : text;
}

function checkPrice(value: unknown, errors: Errors): number | undefined {
  if (value === undefined || value === null) {
    errors.priceCents = 'Price is required.';
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.priceCents = 'Price must be a whole number of cents.';
    return undefined;
  }
  if (value < PRICE_MIN_CENTS || value > PRICE_MAX_CENTS) {
    errors.priceCents = `Price must be ${PRICE_RANGE}.`;
    return undefined;
  }
  return value;
}

/** Returns the sale price, `null` for "no sale", or undefined when it is invalid (error recorded). */
function checkSalePrice(value: unknown, price: number | undefined, errors: Errors): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.salePriceCents = 'Sale price must be a whole number of cents, or empty for no sale.';
    return undefined;
  }
  if (value < PRICE_MIN_CENTS || value > PRICE_MAX_CENTS) {
    errors.salePriceCents = `Sale price must be ${PRICE_RANGE}.`;
    return undefined;
  }
  if (price !== undefined && value >= price) {
    errors.salePriceCents = 'Sale price must be below the regular price.';
    return undefined;
  }
  return value;
}

function checkStock(value: unknown, errors: Errors): number | undefined {
  if (value === undefined || value === null) {
    errors.stock = 'Stock is required.';
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > STOCK_MAX) {
    errors.stock = `Stock must be a whole number from 0 to ${STOCK_MAX.toLocaleString('en-US')}.`;
    return undefined;
  }
  return value;
}

function checkActive(value: unknown, errors: Errors): boolean | undefined {
  if (typeof value !== 'boolean') {
    errors.active = 'Active must be true or false.';
    return undefined;
  }
  return value;
}

function checkSubcategory(value: unknown, category: string | undefined, errors: Errors): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.subcategory = 'Subcategory must be text.';
    return undefined;
  }
  if (!category) return undefined; // the category error is already reported
  const match = findSubcategory(category, value);
  if (!match) {
    errors.subcategory = `Unknown subcategory for ${category}.`;
    return undefined;
  }
  return match;
}

function fail(errors: Errors): never {
  throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors: errors });
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

/** Validates the body of POST /api/admin/products. Every problem is reported together (400 with `fieldErrors`). */
export function parseProductCreate(body: Raw): ProductInput {
  const errors: Errors = {};
  const name = checkName(body.name, errors);
  const category = checkCategory(body.category, errors);
  const subcategory = isBlank(body.subcategory)
    ? category
      ? defaultSubcategory(category)
      : undefined
    : checkSubcategory(body.subcategory, category, errors);
  const description = isBlank(body.description) ? EMPTY_DESCRIPTION : checkDescription(body.description, errors);
  const priceCents = checkPrice(body.priceCents, errors);
  const salePriceCents = body.salePriceCents === undefined ? null : checkSalePrice(body.salePriceCents, priceCents, errors);
  const stock = checkStock(body.stock, errors);
  const active = body.active === undefined ? true : checkActive(body.active, errors);

  if (
    Object.keys(errors).length > 0 ||
    name === undefined ||
    category === undefined ||
    subcategory === undefined ||
    description === undefined ||
    priceCents === undefined ||
    salePriceCents === undefined ||
    stock === undefined ||
    active === undefined
  ) {
    fail(errors);
  }
  return { name, category, subcategory, description, priceCents, salePriceCents, stock, active };
}

const PATCHABLE = ['name', 'category', 'subcategory', 'description', 'priceCents', 'salePriceCents', 'stock', 'active', 'removeImage'];

/**
 * Validates the body of PATCH /api/admin/products/{id}: any subset of the create fields (400 with `fieldErrors`
 * for each bad one, `body` when nothing changeable was sent). Changing the category without a subcategory moves
 * the product to that category's default subcategory. A sale price must stay below the price that will result,
 * so lowering the price below an existing sale price is rejected on `salePriceCents`. A product with variants
 * takes its stock from them, so `stock` is rejected for it.
 */
export function parseProductPatch(body: Raw, current: CurrentProduct, hasImageFile = false): ProductPatch {
  const errors: Errors = {};
  const patch: ProductPatch = {};
  if (!PATCHABLE.some((k) => body[k] !== undefined) && !hasImageFile) {
    errors.body = 'Send at least one field to change.';
    fail(errors);
  }

  if (body.name !== undefined) patch.name = checkName(body.name, errors);
  let category: string | undefined = current.category;
  if (body.category !== undefined) {
    category = checkCategory(body.category, errors);
    patch.category = category;
  }
  if (!isBlank(body.subcategory)) {
    patch.subcategory = checkSubcategory(body.subcategory, category, errors);
  } else if (patch.category !== undefined && patch.category !== current.category) {
    patch.subcategory = defaultSubcategory(patch.category);
  }
  if (body.description !== undefined) patch.description = checkDescription(body.description, errors);

  let price: number | undefined = current.priceCents;
  if (body.priceCents !== undefined) {
    price = checkPrice(body.priceCents, errors);
    patch.priceCents = price;
  }
  if (body.salePriceCents !== undefined) {
    patch.salePriceCents = checkSalePrice(body.salePriceCents, price, errors);
  } else if (patch.priceCents !== undefined && current.salePriceCents !== null && patch.priceCents <= current.salePriceCents) {
    errors.salePriceCents = 'Sale price must be below the regular price. Change or clear the sale price too.';
  }

  if (body.stock !== undefined) {
    if (current.hasVariants) errors.stock = 'This product has options, so its stock is the total of its variants and cannot be set here.';
    else patch.stock = checkStock(body.stock, errors);
  }
  if (body.active !== undefined) patch.active = checkActive(body.active, errors);
  if (body.removeImage !== undefined) {
    if (typeof body.removeImage !== 'boolean') errors.removeImage = 'removeImage must be true or false.';
    else patch.removeImage = body.removeImage;
  }
  if (Object.keys(errors).length > 0) fail(errors);

  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as ProductPatch;
}

/**
 * Multipart forms send every value as text. Turns whole-number text into numbers and "true"/"false" into booleans
 * so the same rules apply as for JSON. An empty price or stock counts as missing; an empty `salePriceCents` means
 * "no sale price" (null); text that is not a number is left as text, so the rules report it.
 */
export function coerceFormFields(fields: Record<string, string>): Raw {
  const out: Raw = {};
  for (const [key, raw] of Object.entries(fields)) {
    const text = raw.trim();
    if (key === 'salePriceCents') {
      out[key] = text === '' ? null : /^-?\d+$/.test(text) ? Number(text) : raw;
    } else if (key === 'priceCents' || key === 'stock') {
      if (text === '') continue;
      out[key] = /^-?\d+$/.test(text) ? Number(text) : raw;
    } else if (key === 'active' || key === 'removeImage') {
      out[key] = text === 'true' ? true : text === 'false' ? false : raw;
    } else {
      out[key] = raw;
    }
  }
  return out;
}
