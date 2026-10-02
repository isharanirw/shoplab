import { describe, expect, it } from 'vitest';
import { formatDate, formatPrice, pluralise } from './format';

describe('formatPrice', () => {
  it('shows dollars with two decimals', () => {
    expect(formatPrice(500)).toBe('$5.00');
    expect(formatPrice(1999)).toBe('$19.99');
    expect(formatPrice(49900)).toBe('$499.00');
    expect(formatPrice(5)).toBe('$0.05');
  });
});

describe('formatDate', () => {
  it('uses D Mon YYYY in UTC', () => {
    expect(formatDate('2026-02-05T12:00:00.000Z')).toBe('5 Feb 2026');
    expect(formatDate('2026-12-31T23:59:59.000Z')).toBe('31 Dec 2026');
  });
  it('returns an empty string for an invalid date', () => {
    expect(formatDate('nope')).toBe('');
  });
});

describe('pluralise', () => {
  it('chooses singular only for exactly one', () => {
    expect(pluralise(1, 'review')).toBe('1 review');
    expect(pluralise(0, 'review')).toBe('0 reviews');
    expect(pluralise(28, 'review')).toBe('28 reviews');
  });
});
