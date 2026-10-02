import { describe, expect, it } from 'vitest';
import { numberAttribute, starModel } from './stars';

describe('starModel', () => {
  it('rounds the average to the nearest whole star', () => {
    expect(starModel(4.4, 10, true).filled).toBe(4);
    expect(starModel(4.5, 10, true).filled).toBe(5);
    expect(starModel(0, 0, true)).toMatchObject({ filled: 0, empty: 5 });
  });

  it('formats the value with one decimal and the optional count', () => {
    expect(starModel(4, 28, true)).toMatchObject({ valueText: '4.0', countText: '(28)' });
    expect(starModel(3.96, 5, false)).toMatchObject({ valueText: '4.0', countText: '' });
  });

  it('keeps out-of-range input inside 0 to 5 stars', () => {
    expect(starModel(9, 1, true).filled).toBe(5);
    expect(starModel(-2, 1, true).filled).toBe(0);
    expect(starModel(Number.NaN, 1, true).filled).toBe(0);
  });
});

describe('numberAttribute', () => {
  it('reads numbers and falls back otherwise', () => {
    expect(numberAttribute('4.5', 0)).toBe(4.5);
    expect(numberAttribute(null, 3)).toBe(3);
    expect(numberAttribute('abc', 2)).toBe(2);
    expect(numberAttribute('  ', 1)).toBe(1);
  });
});
