import type { ShippingMethod } from './pricing';

/** The preferred delivery date may be tomorrow up to this many days ahead (today is day 0, UTC). */
export const DELIVERY_WINDOW_DAYS = 14;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses YYYY-MM-DD as a UTC date; null when it is not a real calendar date. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return toIsoDate(date) === value ? date : null;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) throw new Error(`Invalid date: ${isoDate}`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** Saturday and Sunday, in UTC. */
export function isWeekend(isoDate: string): boolean {
  const date = parseIsoDate(isoDate);
  if (!date) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** The first and last allowed delivery dates: tomorrow and 14 days ahead, from today's UTC date. */
export function deliveryWindow(now: Date): { earliest: string; latest: string } {
  const today = toIsoDate(now);
  return { earliest: addDays(today, 1), latest: addDays(today, DELIVERY_WINDOW_DAYS) };
}

/** Returns an error message, or null when the date is allowed for the shipping method. */
export function validateDeliveryDate(value: unknown, method: ShippingMethod, now: Date): string | null {
  if (typeof value !== 'string' || value === '') return 'Choose a delivery date.';
  if (!parseIsoDate(value)) return 'Delivery date must be a real date in the form YYYY-MM-DD.';
  const { earliest, latest } = deliveryWindow(now);
  if (value < earliest || value > latest) return 'Delivery date must be from tomorrow to 14 days ahead.';
  if (method === 'standard' && isWeekend(value)) return 'Standard delivery is not available on weekends.';
  return null;
}
