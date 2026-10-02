import type { Db } from '../db/connection';
import type { AdminOrderQuery } from '../lib/adminQuery';
import { ApiError } from '../lib/errors';
import { isOrderStatus, transitionProblem } from '../lib/orderStatus';
import type { OrderStatus } from '../lib/orderQuery';
import type { ListResult } from './catalogue';
import { applyCancellation } from './orders';

export interface AdminOrder {
  id: number;
  number: string;
  status: OrderStatus;
  createdAt: string;
  deliveryDate: string;
  itemCount: number;
  totalCents: number;
  customer: { id: number; name: string; email: string };
}

interface Row {
  id: number;
  number: string;
  status: OrderStatus;
  created_at: string;
  delivery_date: string;
  total_cents: number;
  item_count: number;
  user_id: number;
  user_name: string;
  user_email: string;
}

const SELECT = `
  SELECT o.id, o.number, o.status, o.created_at, o.delivery_date, o.total_cents,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count,
         u.id AS user_id, u.name AS user_name, u.email AS user_email
  FROM orders o JOIN users u ON u.id = o.user_id`;

function toOrder(row: Row): AdminOrder {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    createdAt: row.created_at,
    deliveryDate: row.delivery_date,
    itemCount: row.item_count,
    totalCents: row.total_cents,
    customer: { id: row.user_id, name: row.user_name, email: row.user_email },
  };
}

export function getAdminOrder(db: Db, id: number): AdminOrder | null {
  const row = db.prepare(`${SELECT} WHERE o.id = ?`).get(id) as Row | undefined;
  return row ? toOrder(row) : null;
}

/** Every customer's orders, newest first (ties by highest ID), optionally one status. A page past the end is an empty list. */
export function listAdminOrders(db: Db, query: AdminOrderQuery): ListResult<AdminOrder> {
  const where = query.status ? 'WHERE o.status = ?' : '';
  const params = query.status ? [query.status] : [];
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM orders o ${where}`).get(...params) as { n: number };
  const rows = db
    .prepare(`${SELECT} ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`)
    .all(...params, query.pageSize, (query.page - 1) * query.pageSize) as Row[];
  return { data: rows.map(toOrder), page: query.page, pageSize: query.pageSize, total: n };
}

/**
 * Moves an order to a new status (see ALLOWED_TRANSITIONS). 400 for an unknown status, 404 for an unknown order, 409
 * for a move that is not allowed (including "to the same status" and any change to a Delivered or Cancelled order).
 * Moving to Cancelled gives the stock back exactly as a customer cancel does, in the same transaction.
 */
export function changeOrderStatus(db: Db, orderId: number, requested: unknown): AdminOrder {
  if (!isOrderStatus(requested)) {
    throw new ApiError('VALIDATION_ERROR', 'Choose a valid status.', {
      fieldErrors: { status: 'Must be one of: Processing, Shipped, Delivered, Cancelled.' },
    });
  }
  db.transaction(() => {
    const row = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: OrderStatus } | undefined;
    if (!row) throw new ApiError('NOT_FOUND', 'Order not found.');
    const problem = transitionProblem(row.status, requested);
    if (problem) throw new ApiError('CONFLICT', problem, { fieldErrors: { status: problem } });
    if (requested === 'Cancelled') applyCancellation(db, orderId);
    else db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(requested, orderId);
  })();
  return getAdminOrder(db, orderId)!;
}
