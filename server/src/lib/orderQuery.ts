import { fail, parseChoice, parsePaging } from './catalogueQuery';

export const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SORTS = ['date_desc', 'date_asc', 'total_desc', 'total_asc'] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export const ORDERS_PAGE_SIZE = 5;

export interface OrderListQuery {
  status: OrderStatus | null;
  sort: OrderSort;
  page: number;
  pageSize: number;
}

/** Parses the query string of GET /api/orders. Bad values give a 400 with a message per parameter. */
export function parseOrderListQuery(raw: Record<string, unknown>): OrderListQuery {
  const errors: Record<string, string> = {};
  const status = parseChoice(raw, 'status', errors, ORDER_STATUSES) ?? null;
  const sort = parseChoice(raw, 'sort', errors, ORDER_SORTS) ?? 'date_desc';
  const { page, pageSize } = parsePaging(raw, errors, ORDERS_PAGE_SIZE);
  if (Object.keys(errors).length > 0) fail(errors);
  return { status, sort, page, pageSize };
}

/** ORDER BY clauses. Ties always fall back to newest first, then highest ID, so paging is stable. */
export const ORDER_SORT_SQL: Record<OrderSort, string> = {
  date_desc: 'o.created_at DESC, o.id DESC',
  date_asc: 'o.created_at ASC, o.id ASC',
  total_desc: 'o.total_cents DESC, o.created_at DESC, o.id DESC',
  total_asc: 'o.total_cents ASC, o.created_at DESC, o.id DESC',
};
