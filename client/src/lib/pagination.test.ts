import { describe, expect, it } from 'vitest';
import { pageWindow, totalPagesOf } from './pagination';

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([]);
  });
  it('collapses far pages with ellipses', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'ellipsis-end', 20]);
    expect(pageWindow(10, 20)).toEqual([1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'ellipsis-start', 19, 20]);
  });
});

describe('totalPagesOf', () => {
  it('rounds up', () => {
    expect(totalPagesOf(60, 12)).toBe(5);
    expect(totalPagesOf(61, 12)).toBe(6);
    expect(totalPagesOf(0, 12)).toBe(0);
  });
});
