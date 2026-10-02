import { fail, parseChoice, parsePaging, single } from './catalogueQuery';
import { ORDER_STATUSES } from './orderQuery';
import type { OrderStatus } from './orderQuery';

export const ADMIN_PAGE_SIZE = 10;
const MAX_SEARCH_LENGTH = 100;

type Raw = Record<string, unknown>;
type Errors = Record<string, string>;

function parseSearch(raw: Raw, errors: Errors): string {
  const q = single(raw, 'q', errors)?.trim() ?? '';
  if (q.length > MAX_SEARCH_LENGTH) {
    errors.q = `Must be at most ${MAX_SEARCH_LENGTH} characters.`;
    return '';
  }
  return q;
}

export interface AdminProductQuery {
  q: string;
  /** null lists every product; true or false keeps only active or only inactive ones. */
  active: boolean | null;
  page: number;
  pageSize: number;
}

/** GET /api/admin/products: `q` (name contains), `active` (true or false), `page`, `pageSize` (default 10, max 50). */
export function parseAdminProductQuery(raw: Raw): AdminProductQuery {
  const errors: Errors = {};
  const q = parseSearch(raw, errors);
  const activeText = parseChoice(raw, 'active', errors, ['true', 'false'] as const);
  const { page, pageSize } = parsePaging(raw, errors, ADMIN_PAGE_SIZE);
  if (Object.keys(errors).length > 0) fail(errors);
  return { q, active: activeText === undefined ? null : activeText === 'true', page, pageSize };
}

export interface AdminOrderQuery {
  status: OrderStatus | null;
  page: number;
  pageSize: number;
}

/** GET /api/admin/orders: `status`, `page`, `pageSize` (default 10, max 50). Always newest first. */
export function parseAdminOrderQuery(raw: Raw): AdminOrderQuery {
  const errors: Errors = {};
  const status = parseChoice(raw, 'status', errors, ORDER_STATUSES) ?? null;
  const { page, pageSize } = parsePaging(raw, errors, ADMIN_PAGE_SIZE);
  if (Object.keys(errors).length > 0) fail(errors);
  return { status, page, pageSize };
}

export interface AdminUserQuery {
  q: string;
  page: number;
  pageSize: number;
}

/** GET /api/admin/users: `q` (name or email contains), `page`, `pageSize` (default 10, max 50). Ordered by ID. */
export function parseAdminUserQuery(raw: Raw): AdminUserQuery {
  const errors: Errors = {};
  const q = parseSearch(raw, errors);
  const { page, pageSize } = parsePaging(raw, errors, ADMIN_PAGE_SIZE);
  if (Object.keys(errors).length > 0) fail(errors);
  return { q, page, pageSize };
}
