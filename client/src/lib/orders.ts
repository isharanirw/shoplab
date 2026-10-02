export const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SORTS = ['date_desc', 'date_asc', 'total_desc', 'total_asc'] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export const DEFAULT_ORDER_SORT: OrderSort = 'date_desc';
export const ORDERS_PAGE_SIZE = 5;

export interface OrderListState {
  status: OrderStatus | null;
  sort: OrderSort;
  page: number;
}

/** Reads the order list state from the URL query string. Unknown or invalid values fall back to the defaults. */
export function parseOrderListState(params: URLSearchParams): OrderListState {
  const status = params.get('status');
  const sort = params.get('sort');
  const page = Number(params.get('page'));
  return {
    status: (ORDER_STATUSES as readonly string[]).includes(status ?? '') ? (status as OrderStatus) : null,
    sort: (ORDER_SORTS as readonly string[]).includes(sort ?? '') ? (sort as OrderSort) : DEFAULT_ORDER_SORT,
    page: Number.isInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1,
  };
}

/** Builds the query string for the page URL. Default values are left out so the plain URL stays clean. */
export function orderListSearch(state: OrderListState): string {
  const params = new URLSearchParams();
  if (state.status) params.set('status', state.status);
  if (state.sort !== DEFAULT_ORDER_SORT) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** Builds the API request for the same state (the API always gets the page size and sort). */
export function orderListApiPath(state: OrderListState): string {
  const params = new URLSearchParams({ sort: state.sort, page: String(state.page), pageSize: String(ORDERS_PAGE_SIZE) });
  if (state.status) params.set('status', state.status);
  return `/api/orders?${params.toString()}`;
}

export type SortColumn = 'date' | 'total';

/** The sort that results from clicking a column header: a new column starts with its natural order, the same column flips. */
export function nextSort(current: OrderSort, column: SortColumn): OrderSort {
  if (column === 'date') return current === 'date_desc' ? 'date_asc' : 'date_desc';
  return current === 'total_desc' ? 'total_asc' : 'total_desc';
}

/** The aria-sort value of a column header for the current sort. */
export function ariaSortFor(current: OrderSort, column: SortColumn): 'ascending' | 'descending' | 'none' {
  if (!current.startsWith(column)) return 'none';
  return current.endsWith('_asc') ? 'ascending' : 'descending';
}
