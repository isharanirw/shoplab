import type { ShippingMethod } from '../api/types';

/** Mirrors the server rule: tomorrow up to 14 days ahead, from today's UTC date. */
export const DELIVERY_WINDOW_DAYS = 14;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** The calendar starts its weeks on Monday. */
export const WEEKDAY_HEADERS = [
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
  { short: 'Sun', long: 'Sunday' },
];

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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

export function isWeekend(isoDate: string): boolean {
  const date = parseIsoDate(isoDate);
  if (!date) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export interface DeliveryWindow {
  earliest: string;
  latest: string;
}

export function deliveryWindow(now: Date): DeliveryWindow {
  const today = toIsoDate(now);
  return { earliest: addDays(today, 1), latest: addDays(today, DELIVERY_WINDOW_DAYS) };
}

export type DisabledReason = 'before-window' | 'after-window' | 'weekend';

/** Why a date cannot be chosen for the shipping method, or null when it can. */
export function disabledReason(isoDate: string, window: DeliveryWindow, method: ShippingMethod): DisabledReason | null {
  if (isoDate < window.earliest) return 'before-window';
  if (isoDate > window.latest) return 'after-window';
  if (method === 'standard' && isWeekend(isoDate)) return 'weekend';
  return null;
}

export function disabledText(reason: DisabledReason): string {
  if (reason === 'before-window') return 'unavailable, delivery starts tomorrow';
  if (reason === 'after-window') return `unavailable, more than ${DELIVERY_WINDOW_DAYS} days ahead`;
  return 'unavailable, Standard delivery is not available on weekends';
}

export interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
  disabled: DisabledReason | null;
}

/** Weeks (Monday first) covering one month; days from the neighbouring months fill the first and last week. */
export function monthGrid(year: number, month: number, window: DeliveryWindow, method: ShippingMethod): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(year, month, 1 - offset));
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + w * 7 + d));
      const iso = toIsoDate(date);
      week.push({ iso, day: date.getUTCDate(), inMonth: date.getUTCMonth() === month, disabled: disabledReason(iso, window, method) });
    }
    if (w > 0 && !week.some((day) => day.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** "Monday, 5 October 2026" for assistive technology. */
export function longDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  return `${WEEKDAY_NAMES[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "5 Oct 2026", the site-wide date format. */
export function shortDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Moves a focused date for calendar keys, clamped to [min, max]. Returns null for keys it does not handle. */
export function moveFocus(current: string, key: string, shift: boolean, min: string, max: string): string | null {
  let next: string;
  switch (key) {
    case 'ArrowLeft':
      next = addDays(current, -1);
      break;
    case 'ArrowRight':
      next = addDays(current, 1);
      break;
    case 'ArrowUp':
      next = addDays(current, -7);
      break;
    case 'ArrowDown':
      next = addDays(current, 7);
      break;
    case 'Home': {
      const offset = ((parseIsoDate(current)?.getUTCDay() ?? 1) + 6) % 7;
      next = addDays(current, -offset);
      break;
    }
    case 'End': {
      const offset = ((parseIsoDate(current)?.getUTCDay() ?? 1) + 6) % 7;
      next = addDays(current, 6 - offset);
      break;
    }
    case 'PageUp':
    case 'PageDown': {
      const date = parseIsoDate(current);
      if (!date) return null;
      const step = (key === 'PageUp' ? -1 : 1) * (shift ? 12 : 1);
      const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
      next = toIsoDate(target);
      break;
    }
    default:
      return null;
  }
  if (next < min) return min;
  if (next > max) return max;
  return next;
}
