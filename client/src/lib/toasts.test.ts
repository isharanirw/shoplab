import { describe, expect, it } from 'vitest';
import { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS, addToast, nextToastId, removeToast } from './toasts';
import type { Toast } from './toasts';

const toast = (id: number): Toast => ({ id, kind: 'success', message: `Message ${id}` });

describe('toast list', () => {
  it('disappears after 4 seconds', () => {
    expect(TOAST_DURATION_MS).toBe(4000);
  });

  it('appends toasts in order', () => {
    expect(addToast([toast(1)], toast(2)).map((t) => t.id)).toEqual([1, 2]);
  });

  it('keeps only the newest toasts when the limit is passed', () => {
    let list: Toast[] = [];
    for (let id = 1; id <= MAX_VISIBLE_TOASTS + 2; id += 1) list = addToast(list, toast(id));
    expect(list).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(list[0]?.id).toBe(3);
  });

  it('removes one toast by ID and leaves the others', () => {
    expect(removeToast([toast(1), toast(2), toast(3)], 2).map((t) => t.id)).toEqual([1, 3]);
    expect(removeToast([toast(1)], 99)).toHaveLength(1);
  });

  it('hands out increasing IDs', () => {
    expect(nextToastId([], 0)).toBe(1);
    expect(nextToastId([toast(5)], 2)).toBe(6);
    expect(nextToastId([], 7)).toBe(8);
  });
});
