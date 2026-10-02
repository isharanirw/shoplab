import { describe, expect, it } from 'vitest';
import { deliveryWindow, disabledReason, isWeekend, longDate, monthGrid, moveFocus, shortDate } from './delivery';

const FRIDAY = new Date('2026-10-02T09:00:00.000Z');
const WINDOW = deliveryWindow(FRIDAY);

describe('delivery window', () => {
  it('is tomorrow to 14 days ahead from the UTC date', () => {
    expect(WINDOW).toEqual({ earliest: '2026-10-03', latest: '2026-10-16' });
    expect(deliveryWindow(new Date('2026-10-02T23:59:59.000Z')).earliest).toBe('2026-10-03');
  });

  it('disables today, the past and day 15 for everyone', () => {
    expect(disabledReason('2026-10-02', WINDOW, 'express')).toBe('before-window');
    expect(disabledReason('2026-09-01', WINDOW, 'express')).toBe('before-window');
    expect(disabledReason('2026-10-17', WINDOW, 'express')).toBe('after-window');
    expect(disabledReason('2026-10-03', WINDOW, 'express')).toBeNull();
    expect(disabledReason('2026-10-16', WINDOW, 'express')).toBeNull();
  });

  it('disables weekends for Standard only', () => {
    expect(isWeekend('2026-10-03')).toBe(true);
    expect(disabledReason('2026-10-03', WINDOW, 'standard')).toBe('weekend');
    expect(disabledReason('2026-10-04', WINDOW, 'standard')).toBe('weekend');
    expect(disabledReason('2026-10-03', WINDOW, 'express')).toBeNull();
    expect(disabledReason('2026-10-05', WINDOW, 'standard')).toBeNull();
  });
});

describe('calendar grid', () => {
  it('lays out October 2026 in Monday-first weeks', () => {
    const weeks = monthGrid(2026, 9, WINDOW, 'standard');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // 1 October 2026 is a Thursday, so the first week starts on Monday 28 September.
    expect(weeks[0]![0]).toMatchObject({ iso: '2026-09-28', inMonth: false });
    expect(weeks[0]![3]).toMatchObject({ iso: '2026-10-01', day: 1, inMonth: true, disabled: 'before-window' });
    expect(weeks[0]![5]).toMatchObject({ iso: '2026-10-03', disabled: 'weekend' });
  });

  it('marks the same days available for Express', () => {
    const express = monthGrid(2026, 9, WINDOW, 'express').flat().filter((d) => d.disabled === null).map((d) => d.iso);
    expect(express[0]).toBe('2026-10-03');
    expect(express).toHaveLength(14);
    const standard = monthGrid(2026, 9, WINDOW, 'standard').flat().filter((d) => d.disabled === null && d.inMonth);
    expect(standard.map((d) => d.iso)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('formats dates for people and screen readers', () => {
    expect(longDate('2026-10-05')).toBe('Monday, 5 October 2026');
    expect(shortDate('2026-10-05')).toBe('5 Oct 2026');
  });
});

describe('keyboard movement', () => {
  const [min, max] = ['2026-10-01', '2026-11-30'] as const;

  it('moves by day and week', () => {
    expect(moveFocus('2026-10-14', 'ArrowRight', false, min, max)).toBe('2026-10-15');
    expect(moveFocus('2026-10-14', 'ArrowLeft', false, min, max)).toBe('2026-10-13');
    expect(moveFocus('2026-10-14', 'ArrowDown', false, min, max)).toBe('2026-10-21');
    expect(moveFocus('2026-10-14', 'ArrowUp', false, min, max)).toBe('2026-10-07');
  });

  it('jumps to the start and end of the week (Monday to Sunday)', () => {
    expect(moveFocus('2026-10-14', 'Home', false, min, max)).toBe('2026-10-12');
    expect(moveFocus('2026-10-14', 'End', false, min, max)).toBe('2026-10-18');
    expect(moveFocus('2026-10-18', 'Home', false, min, max)).toBe('2026-10-12');
  });

  it('moves by month and keeps the day within short months', () => {
    expect(moveFocus('2026-10-31', 'PageDown', false, min, max)).toBe('2026-11-30');
    expect(moveFocus('2026-10-14', 'PageDown', false, min, max)).toBe('2026-11-14');
    expect(moveFocus('2026-11-14', 'PageUp', false, min, max)).toBe('2026-10-14');
  });

  it('stays inside the allowed range and ignores other keys', () => {
    expect(moveFocus('2026-10-01', 'ArrowLeft', false, min, max)).toBe(min);
    expect(moveFocus('2026-11-30', 'ArrowDown', false, min, max)).toBe(max);
    expect(moveFocus('2026-10-14', 'a', false, min, max)).toBeNull();
  });
});
