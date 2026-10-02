import type { Request } from 'express';
import { isActive } from './flags';

/*
 * Hooks for the optional variants. Each function returns its input unchanged unless its flag is active.
 * Flags are referred to by ID only.
 */

/** f01 */
export const f01 = (op: '<='): '<=' | '<' => (isActive('f01') ? '<' : op);

/** f02 */
export const f02 = (afterDiscount: number, subtotal: number): number => (isActive('f02') ? subtotal : afterDiscount);

/** f03 */
export const f03 = (min: number): number => (isActive('f03') ? 7 : min);

/** f04 */
export const f04 = (): boolean => isActive('f04');

/** f05 */
export const f05 = (status: number): number => (isActive('f05') ? 200 : status);

/** f07 */
export const f07 = (afterDiscount: number, percent: number, rounded: number): number =>
  isActive('f07') ? Math.floor((afterDiscount * percent) / 100) : rounded;

/** f08 */
export const f08 = (userId: number): number | null => (isActive('f08') ? null : userId);

/** f09 */
export const f09 = (pattern: string): string => (isActive('f09') ? pattern.replace(/\$$/, '') : pattern);

/** f10 */
export const f10 = (): boolean => isActive('f10');

/** f11 */
export const f11 = (nameExpr: string, needleExpr: string): string =>
  isActive('f11') ? `instr(${nameExpr}, ${needleExpr})` : `instr(lower(${nameExpr}), lower(${needleExpr}))`;

/** f13 */
export const f13 = (subtotal: number, minimum: number): boolean => (isActive('f13') && minimum > 0 ? subtotal <= minimum : subtotal < minimum);

/** f14 */
export const f14 = (pattern: RegExp): RegExp => (isActive('f14') ? /^[^\s@]+@[^\s@]+$/ : pattern);

/** f15 */
export const f15 = (req: Request): boolean => isActive('f15') && req.method === 'GET' && req.path === '/orders';

/** f17 */
export const f17 = (flag: boolean): boolean => (isActive('f17') ? false : flag);

/** f19 */
export const f19 = (min: number): number => (isActive('f19') ? 6 : min);

/** f20 */
export const f20 = (offset: number): number => (isActive('f20') && offset > 0 ? offset - 1 : offset);

/** f21 */
export const f21 = (): boolean => isActive('f21');

/** f23 */
export function f23(method: string, shippingCents: number, totalCents: number): { shippingCents: number; totalCents: number } {
  if (!isActive('f23') || method !== 'express') return { shippingCents, totalCents };
  return { shippingCents: 500, totalCents: totalCents - shippingCents + 500 };
}

/** f24 */
export function f24<T extends Record<string, unknown>>(body: T): Record<string, unknown> {
  if (!isActive('f24')) return body;
  const { uptimeSeconds, ...rest } = body;
  return { ...rest, uptime: uptimeSeconds };
}

/** f25 */
export const f25 = (min: number): number => (isActive('f25') ? min - 1 : min);

/** f18 */
export const f18 = (status: number): number => (isActive('f18') ? 200 : status);
