import { describe, expect, it } from 'vitest';
import { addDays, deliveryWindow, isWeekend, parseIsoDate, validateDeliveryDate } from './delivery';

// Friday 2 October 2026 (UTC).
const FRIDAY = new Date('2026-10-02T09:00:00.000Z');

describe('delivery window', () => {
  it('runs from tomorrow to 14 days ahead, from the UTC date', () => {
    expect(deliveryWindow(FRIDAY)).toEqual({ earliest: '2026-10-03', latest: '2026-10-16' });
  });

  it('uses the UTC date even late in the evening', () => {
    expect(deliveryWindow(new Date('2026-10-02T23:59:59.000Z')).earliest).toBe('2026-10-03');
    expect(deliveryWindow(new Date('2026-10-03T00:00:00.000Z')).earliest).toBe('2026-10-04');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
    expect(addDays('2026-02-20', 14)).toBe('2026-03-06');
  });
});

describe('weekends', () => {
  it('knows Saturday and Sunday', () => {
    expect(isWeekend('2026-10-03')).toBe(true); // Saturday
    expect(isWeekend('2026-10-04')).toBe(true); // Sunday
    expect(isWeekend('2026-10-05')).toBe(false); // Monday
    expect(isWeekend('2026-10-02')).toBe(false); // Friday
  });

  it('rejects dates that do not exist', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('10/02/2026')).toBeNull();
  });
});

describe('validateDeliveryDate', () => {
  it('rejects today and the past', () => {
    expect(validateDeliveryDate('2026-10-02', 'express', FRIDAY)).toMatch(/tomorrow/);
    expect(validateDeliveryDate('2026-09-30', 'express', FRIDAY)).toMatch(/tomorrow/);
  });

  it('accepts tomorrow and day 14, rejects day 15', () => {
    expect(validateDeliveryDate('2026-10-03', 'express', FRIDAY)).toBeNull(); // Saturday, express
    expect(validateDeliveryDate('2026-10-16', 'standard', FRIDAY)).toBeNull(); // Friday, day 14
    expect(validateDeliveryDate('2026-10-17', 'express', FRIDAY)).toMatch(/14 days/);
  });

  it('rejects weekends for Standard but allows them for Express', () => {
    expect(validateDeliveryDate('2026-10-03', 'standard', FRIDAY)).toBe('Standard delivery is not available on weekends.');
    expect(validateDeliveryDate('2026-10-04', 'standard', FRIDAY)).toBe('Standard delivery is not available on weekends.');
    expect(validateDeliveryDate('2026-10-04', 'express', FRIDAY)).toBeNull();
    expect(validateDeliveryDate('2026-10-05', 'standard', FRIDAY)).toBeNull();
  });

  it('requires a real date string', () => {
    expect(validateDeliveryDate(undefined, 'standard', FRIDAY)).toBe('Choose a delivery date.');
    expect(validateDeliveryDate('', 'standard', FRIDAY)).toBe('Choose a delivery date.');
    expect(validateDeliveryDate('soon', 'standard', FRIDAY)).toMatch(/real date/);
  });
});
