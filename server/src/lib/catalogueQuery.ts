import { ApiError } from './errors';

export const PRODUCT_SORTS = ['price_asc', 'price_desc', 'rating', 'newest'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const REVIEW_SORTS = ['newest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
export const REVIEWS_PAGE_SIZE = 5;
export const MAX_QUERY_LENGTH = 100;

export interface CategoryInfo {
  name: string;
  subcategories: string[];
}

export interface ProductQuery {
  q: string;
  /** Canonical category names; empty means all categories. */
  categories: string[];
  subcategory: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  inStock: boolean;
  /** Minimum average rating, 1 to 5; null means no rating filter. */
  minRating: number | null;
  featured: boolean;
  /** null keeps the default order (product ID ascending). */
  sort: ProductSort | null;
  page: number;
  pageSize: number;
}

export interface ReviewQuery {
  sort: ReviewSort;
  page: number;
  pageSize: number;
}

type Raw = Record<string, unknown>;
type Errors = Record<string, string>;

/** Returns the single string value for a key, or undefined when absent or empty. */
function single(raw: Raw, key: string, errors: Errors): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    errors[key] = 'Provide this parameter only once.';
    return undefined;
  }
  if (typeof value !== 'string') {
    errors[key] = 'Invalid value.';
    return undefined;
  }
  return value === '' ? undefined : value;
}

function parseInteger(raw: Raw, key: string, errors: Errors, min: number, max: number): number | undefined {
  const value = single(raw, key, errors);
  if (value === undefined) return undefined;
  if (!/^\d{1,9}$/.test(value)) {
    errors[key] = 'Must be a whole number.';
    return undefined;
  }
  const n = Number(value);
  if (n < min || n > max) {
    errors[key] = `Must be between ${min} and ${max}.`;
    return undefined;
  }
  return n;
}

/** Parses a price in dollars such as "10" or "10.50" into integer cents. */
function parseDollars(raw: Raw, key: string, errors: Errors): number | undefined {
  const value = single(raw, key, errors);
  if (value === undefined) return undefined;
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    errors[key] = 'Must be an amount in dollars with at most 2 decimals, such as 10 or 10.50.';
    return undefined;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

function parseBoolean(raw: Raw, key: string, errors: Errors): boolean {
  const value = single(raw, key, errors);
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  errors[key] = 'Must be true or false.';
  return false;
}

function parseChoice<T extends string>(raw: Raw, key: string, errors: Errors, allowed: readonly T[]): T | undefined {
  const value = single(raw, key, errors);
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  errors[key] = `Must be one of: ${allowed.join(', ')}.`;
  return undefined;
}

function parsePaging(raw: Raw, errors: Errors, defaultSize: number): { page: number; pageSize: number } {
  const page = parseInteger(raw, 'page', errors, 1, 1_000_000) ?? 1;
  const pageSize = parseInteger(raw, 'pageSize', errors, 1, MAX_PAGE_SIZE) ?? defaultSize;
  return { page, pageSize };
}

function fail(errors: Errors): never {
  throw new ApiError('VALIDATION_ERROR', 'One or more query parameters are invalid.', { fieldErrors: errors });
}

/** Category values may repeat (`category=A&category=B`) or be comma separated (`category=A,B`). */
function parseCategories(raw: Raw, errors: Errors, known: CategoryInfo[]): string[] {
  const value = raw.category;
  if (value === undefined) return [];
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) => {
    if (typeof v !== 'string') {
      errors.category = 'Invalid value.';
      return [];
    }
    return v.split(',').map((s) => s.trim()).filter((s) => s !== '');
  });
  const result: string[] = [];
  for (const part of parts) {
    const match = known.find((c) => c.name.toLowerCase() === part.toLowerCase());
    if (!match) {
      errors.category = `Unknown category: ${part}.`;
      return [];
    }
    if (!result.includes(match.name)) result.push(match.name);
  }
  return result;
}

export function parseProductQuery(raw: Raw, known: CategoryInfo[]): ProductQuery {
  const errors: Errors = {};

  let q = single(raw, 'q', errors)?.trim() ?? '';
  if (q.length > MAX_QUERY_LENGTH) {
    errors.q = `Must be at most ${MAX_QUERY_LENGTH} characters.`;
    q = '';
  }

  const categories = parseCategories(raw, errors, known);

  let subcategory: string | null = null;
  const subRaw = single(raw, 'subcategory', errors);
  if (subRaw !== undefined) {
    const wanted = subRaw.trim().toLowerCase();
    const match = known.flatMap((c) => c.subcategories).find((s) => s.toLowerCase() === wanted);
    if (match) subcategory = match;
    else errors.subcategory = `Unknown subcategory: ${subRaw}.`;
  }

  const minPriceCents = parseDollars(raw, 'minPrice', errors) ?? null;
  const maxPriceCents = parseDollars(raw, 'maxPrice', errors) ?? null;
  if (minPriceCents !== null && maxPriceCents !== null && minPriceCents > maxPriceCents) {
    errors.minPrice = 'Must not be greater than maxPrice.';
  }

  const inStock = parseBoolean(raw, 'inStock', errors);
  const featured = parseBoolean(raw, 'featured', errors);
  const minRating = parseInteger(raw, 'rating', errors, 1, 5) ?? null;
  const sort = parseChoice(raw, 'sort', errors, PRODUCT_SORTS) ?? null;
  const { page, pageSize } = parsePaging(raw, errors, DEFAULT_PAGE_SIZE);

  if (Object.keys(errors).length > 0) fail(errors);
  return { q, categories, subcategory, minPriceCents, maxPriceCents, inStock, minRating, featured, sort, page, pageSize };
}

export function parseReviewQuery(raw: Raw): ReviewQuery {
  const errors: Errors = {};
  const sort = parseChoice(raw, 'sort', errors, REVIEW_SORTS) ?? 'newest';
  const { page, pageSize } = parsePaging(raw, errors, REVIEWS_PAGE_SIZE);
  if (Object.keys(errors).length > 0) fail(errors);
  return { sort, page, pageSize };
}

/** The suggest endpoint takes only `q`. Returns the trimmed text (possibly empty or too short to search). */
export function parseSuggestQuery(raw: Raw): string {
  const errors: Errors = {};
  const q = single(raw, 'q', errors)?.trim() ?? '';
  if (q.length > MAX_QUERY_LENGTH) errors.q = `Must be at most ${MAX_QUERY_LENGTH} characters.`;
  if (Object.keys(errors).length > 0) fail(errors);
  return q;
}

/** Product IDs in a path must be positive whole numbers. */
export function parseIdParam(value: unknown, field = 'id'): number {
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value) || Number(value) < 1) {
    throw new ApiError('VALIDATION_ERROR', 'The ID must be a positive whole number.', {
      fieldErrors: { [field]: 'Must be a positive whole number.' },
    });
  }
  return Number(value);
}
