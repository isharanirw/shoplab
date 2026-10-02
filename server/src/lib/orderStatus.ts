import { ORDER_STATUSES } from './orderQuery';
import type { OrderStatus } from './orderQuery';

/**
 * Which status an admin may move an order to. Orders only move forward:
 * Processing -> Shipped -> Delivered, and Processing or Shipped -> Cancelled.
 * Delivered and Cancelled are final.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Returns why the move is not allowed, or null when it is. */
export function transitionProblem(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return `The order is already ${from}.`;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (allowed.includes(to)) return null;
  if (allowed.length === 0) return `A ${from} order is final, so its status can no longer be changed.`;
  return `An order cannot move from ${from} to ${to}. From ${from} it can only become ${allowed.join(' or ')}.`;
}
