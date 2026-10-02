import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES } from './orderQuery';
import { ALLOWED_TRANSITIONS, isOrderStatus, transitionProblem } from './orderStatus';

describe('order status transitions', () => {
  it('allows only forward moves and cancelling before delivery', () => {
    expect(transitionProblem('Processing', 'Shipped')).toBeNull();
    expect(transitionProblem('Processing', 'Cancelled')).toBeNull();
    expect(transitionProblem('Shipped', 'Delivered')).toBeNull();
    expect(transitionProblem('Shipped', 'Cancelled')).toBeNull();
  });

  it('refuses skipping a step, going back, and staying put', () => {
    expect(transitionProblem('Processing', 'Delivered')).toMatch(/cannot move from Processing to Delivered/);
    expect(transitionProblem('Shipped', 'Processing')).toMatch(/can only become Delivered or Cancelled/);
    expect(transitionProblem('Shipped', 'Shipped')).toBe('The order is already Shipped.');
  });

  it('treats Delivered and Cancelled as final', () => {
    for (const from of ['Delivered', 'Cancelled'] as const) {
      expect(ALLOWED_TRANSITIONS[from]).toEqual([]);
      for (const to of ORDER_STATUSES) expect(transitionProblem(from, to)).not.toBeNull();
    }
    expect(transitionProblem('Cancelled', 'Processing')).toMatch(/final/);
  });

  it('recognises the four statuses by exact spelling', () => {
    expect(ORDER_STATUSES.every(isOrderStatus)).toBe(true);
    expect(isOrderStatus('shipped')).toBe(false);
    expect(isOrderStatus(3)).toBe(false);
  });
});
