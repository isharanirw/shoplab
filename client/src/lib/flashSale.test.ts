import { describe, expect, it } from 'vitest';
import { flashSaleEnd, formatCountdown, secondsRemaining } from './flashSale';

describe('flashSaleEnd', () => {
  it('is the next UTC midnight', () => {
    expect(flashSaleEnd(new Date('2026-10-02T13:45:10.500Z')).toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });
  it('moves to the following day at exactly midnight', () => {
    expect(flashSaleEnd(new Date('2026-10-03T00:00:00.000Z')).toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });
  it('rolls over month and year ends', () => {
    expect(flashSaleEnd(new Date('2026-12-31T23:59:59.000Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(flashSaleEnd(new Date('2026-02-28T10:00:00.000Z')).toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('secondsRemaining', () => {
  it('counts down by one each second', () => {
    expect(secondsRemaining(new Date('2026-10-02T23:59:50.000Z'))).toBe(10);
    expect(secondsRemaining(new Date('2026-10-02T23:59:51.000Z'))).toBe(9);
  });
  it('rounds a partial second up so it never shows zero before the end', () => {
    expect(secondsRemaining(new Date('2026-10-02T23:59:59.400Z'))).toBe(1);
  });
  it('is 24 hours at midnight', () => {
    expect(secondsRemaining(new Date('2026-10-02T00:00:00.000Z'))).toBe(86400);
  });
});

describe('formatCountdown', () => {
  it('pads hours, minutes and seconds', () => {
    expect(formatCountdown(3725)).toBe('01:02:05');
    expect(formatCountdown(86400)).toBe('24:00:00');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});
