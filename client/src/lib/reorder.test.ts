import { describe, expect, it } from 'vitest';
import { moveAnnouncement, moveItem } from './reorder';

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item down and up so it lands on the target index', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveItem(list, 1, 2)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('does not change the list for the same index or an out-of-range index, and never mutates the input', () => {
    expect(moveItem(list, 2, 2)).toEqual(list);
    expect(moveItem(list, -1, 2)).toEqual(list);
    expect(moveItem(list, 1, 4)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('moveAnnouncement', () => {
  it('names the item and its new place', () => {
    expect(moveAnnouncement('Football', 2, 5)).toBe('Moved Football to position 2 of 5.');
  });
});
