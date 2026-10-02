import { describe, expect, it } from 'vitest';
import { formatOrderNumber, nextSequence, orderNumberPrefix } from './orderNumber';

describe('order numbers', () => {
  const day = new Date('2026-10-02T23:59:59.000Z');

  it('formats SL-YYYYMMDD-NNNN from the UTC date', () => {
    expect(orderNumberPrefix(day)).toBe('SL-20261002-');
    expect(formatOrderNumber(day, 1)).toBe('SL-20261002-0001');
    expect(formatOrderNumber(day, 42)).toBe('SL-20261002-0042');
    expect(formatOrderNumber(new Date('2026-01-05T00:00:00.000Z'), 1234)).toBe('SL-20260105-1234');
  });

  it('uses the UTC date, not the local one', () => {
    expect(formatOrderNumber(new Date('2026-12-31T23:30:00.000Z'), 1)).toBe('SL-20261231-0001');
    expect(formatOrderNumber(new Date('2027-01-01T00:00:00.000Z'), 1)).toBe('SL-20270101-0001');
  });

  it('starts each day at 0001', () => {
    expect(nextSequence([], day)).toBe(1);
    expect(nextSequence(['SL-20261001-0007', 'SL-20260812-0001'], day)).toBe(1);
  });

  it('continues after the highest number already used that day', () => {
    expect(nextSequence(['SL-20261002-0001', 'SL-20261002-0002', 'SL-20261001-0009'], day)).toBe(3);
    expect(nextSequence(['SL-20261002-0005', 'SL-20261002-0002'], day)).toBe(6);
  });

  it('ignores numbers that do not follow the format', () => {
    expect(nextSequence(['SL-20261002-abc', 'junk'], day)).toBe(1);
  });
});
