export const SORT_OPTIONS = [
  { value: '', label: 'Default order' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Rating' },
  { value: 'newest', label: 'Newest' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const RATING_OPTIONS = [4, 3, 2, 1] as const;

/** Everything the listing page keeps in the URL query string. Empty values mean "not set". */
export interface ListFilters {
  q: string;
  categories: string[];
  subcategory: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  rating: number | null;
  sort: SortValue;
  page: number;
}

export const EMPTY_FILTERS: ListFilters = {
  q: '',
  categories: [],
  subcategory: '',
  minPrice: '',
  maxPrice: '',
  inStock: false,
  rating: null,
  sort: '',
  page: 1,
};

const PRICE_RE = /^\d{1,7}(\.\d{1,2})?$/;

/** Reads filters from a query string, quietly dropping anything that is not valid. */
export function parseFilters(params: URLSearchParams): ListFilters {
  const sortParam = params.get('sort') ?? '';
  const sort = SORT_OPTIONS.some((o) => o.value === sortParam) ? (sortParam as SortValue) : '';
  const ratingParam = Number(params.get('rating'));
  const pageParam = Number(params.get('page'));
  const categories = params
    .getAll('category')
    .flatMap((c) => c.split(','))
    .map((c) => c.trim())
    .filter((c, i, all) => c !== '' && all.indexOf(c) === i);
  const price = (key: string) => {
    const v = (params.get(key) ?? '').trim();
    return PRICE_RE.test(v) ? v : '';
  };
  return {
    q: (params.get('q') ?? '').trim(),
    categories,
    subcategory: (params.get('subcategory') ?? '').trim(),
    minPrice: price('minPrice'),
    maxPrice: price('maxPrice'),
    inStock: params.get('inStock') === 'true',
    rating: Number.isInteger(ratingParam) && ratingParam >= 1 && ratingParam <= 5 ? ratingParam : null,
    sort,
    page: Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1,
  };
}

/** Builds the query string for the listing URL. Defaults are left out so URLs stay short and stable. */
export function toSearchParams(filters: ListFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const c of filters.categories) params.append('category', c);
  if (filters.subcategory) params.set('subcategory', filters.subcategory);
  if (filters.minPrice) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.rating !== null) params.set('rating', String(filters.rating));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

/** The same filters as an API query string (always asks for 12 per page). */
export function toApiQuery(filters: ListFilters, pageSize = 12): string {
  const params = toSearchParams(filters);
  params.set('pageSize', String(pageSize));
  return params.toString();
}

/** Returns a message when the two price boxes cannot form a valid range, otherwise null. */
export function priceRangeError(min: string, max: string): string | null {
  const a = min.trim();
  const b = max.trim();
  if (a !== '' && !PRICE_RE.test(a)) return 'Enter the minimum price as an amount such as 10 or 10.50.';
  if (b !== '' && !PRICE_RE.test(b)) return 'Enter the maximum price as an amount such as 50 or 49.99.';
  if (a !== '' && b !== '' && Number(a) > Number(b)) return 'The minimum price cannot be higher than the maximum price.';
  return null;
}

/** True when any filter other than sort and page is set. */
export function hasActiveFilters(f: ListFilters): boolean {
  return (
    f.q !== '' ||
    f.categories.length > 0 ||
    f.subcategory !== '' ||
    f.minPrice !== '' ||
    f.maxPrice !== '' ||
    f.inStock ||
    f.rating !== null
  );
}

/** Category names are matched ignoring case, because the API accepts any case in the URL. */
export function hasCategory(categories: string[], name: string): boolean {
  const lower = name.toLowerCase();
  return categories.some((c) => c.toLowerCase() === lower);
}

export function toggleCategory(categories: string[], name: string): string[] {
  const lower = name.toLowerCase();
  return hasCategory(categories, name) ? categories.filter((c) => c.toLowerCase() !== lower) : [...categories, name];
}
