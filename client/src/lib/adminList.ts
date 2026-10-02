export const ADMIN_PAGE_SIZE = 10;

/** The state of an admin table. It lives in the page URL (`?q=lamp&active=false&page=2`), so a reload or a pasted link restores it. */
export interface AdminListState {
  /** Search text; empty for none. */
  q: string;
  /** The value of the one filter the table has (`active` for products, `status` for orders); empty for all. */
  filter: string;
  page: number;
}

export interface AdminListConfig {
  /** The query parameter that holds the filter, or null when the table has none. */
  filterKey: 'active' | 'status' | null;
  /** The values the filter accepts. Anything else in the URL is ignored. */
  filterValues: readonly string[];
  /** Whether the table has a search box. */
  searchable: boolean;
}

export const PRODUCTS_LIST: AdminListConfig = { filterKey: 'active', filterValues: ['true', 'false'], searchable: true };
export const ORDERS_LIST: AdminListConfig = {
  filterKey: 'status',
  filterValues: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
  searchable: false,
};
export const USERS_LIST: AdminListConfig = { filterKey: null, filterValues: [], searchable: true };

/** Reads the table state from the URL. Unknown or invalid values fall back to the defaults. */
export function parseAdminListState(params: URLSearchParams, config: AdminListConfig): AdminListState {
  const page = Number(params.get('page'));
  const filter = config.filterKey ? (params.get(config.filterKey) ?? '') : '';
  return {
    q: config.searchable ? (params.get('q') ?? '').slice(0, 100) : '',
    filter: config.filterValues.includes(filter) ? filter : '',
    page: Number.isInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1,
  };
}

/** The page URL's query string. Default values are left out so the plain URL stays clean. */
export function adminListSearch(state: AdminListState, config: AdminListConfig): string {
  const params = new URLSearchParams();
  if (state.q.trim() !== '') params.set('q', state.q.trim());
  if (config.filterKey && state.filter !== '') params.set(config.filterKey, state.filter);
  if (state.page > 1) params.set('page', String(state.page));
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** The API request for the same state. */
export function adminListApiPath(base: string, state: AdminListState, config: AdminListConfig): string {
  const params = new URLSearchParams({ page: String(state.page), pageSize: String(ADMIN_PAGE_SIZE) });
  if (state.q.trim() !== '') params.set('q', state.q.trim());
  if (config.filterKey && state.filter !== '') params.set(config.filterKey, state.filter);
  return `${base}?${params.toString()}`;
}
