import { describe, expect, it } from 'vitest';
import { formatFileSize, MAX_IMAGE_BYTES, validateBody, validateImageFile, validateRating, validateReviewValues, validateTitle } from './reviewForm';

describe('review text rules', () => {
  it('needs a rating from 1 to 5', () => {
    expect(validateRating('')).not.toBeNull();
    expect(validateRating('0')).not.toBeNull();
    expect(validateRating('6')).not.toBeNull();
    expect(validateRating('5')).toBeNull();
  });

  it('needs a title of 3 to 100 characters after trimming', () => {
    expect(validateTitle('  ')).toBe('Title is required.');
    expect(validateTitle('ab')).toContain('at least 3');
    expect(validateTitle('abc')).toBeNull();
    expect(validateTitle('x'.repeat(101))).toContain('at most 100');
  });

  it('needs review text of at least 20 characters', () => {
    expect(validateBody('')).toBe('Review text is required.');
    expect(validateBody('a'.repeat(19))).toContain('at least 20');
    expect(validateBody('a'.repeat(20))).toBeNull();
    expect(validateBody(`  ${'a'.repeat(19)}  `)).not.toBeNull();
  });
});

describe('validateImageFile', () => {
  const file = (name: string, size = 1000, type = 'image/png') => ({ name, size, type });

  it('treats no file as fine (the image is optional)', () => {
    expect(validateImageFile(null)).toBeNull();
  });

  it('accepts PNG and JPG files up to 2 MB', () => {
    expect(validateImageFile(file('a.png'))).toBeNull();
    expect(validateImageFile(file('A.JPG', 10, 'image/jpeg'))).toBeNull();
    expect(validateImageFile(file('a.jpeg', 10, 'image/jpeg'))).toBeNull();
    expect(validateImageFile(file('a.png', MAX_IMAGE_BYTES))).toBeNull();
  });

  it('rejects a file over 2 MB, an empty file and other types', () => {
    expect(validateImageFile(file('a.png', MAX_IMAGE_BYTES + 1))).toContain('2 MB');
    expect(validateImageFile(file('a.png', 0))).toContain('empty');
    expect(validateImageFile(file('a.gif', 10, 'image/gif'))).toContain('PNG or JPG');
    expect(validateImageFile(file('a.png', 10, 'application/pdf'))).toContain('PNG or JPG');
    expect(validateImageFile(file('noextension', 10, 'image/png'))).toContain('PNG or JPG');
  });
});

describe('validateReviewValues', () => {
  it('collects every problem', () => {
    const errors = validateReviewValues({ rating: '', title: '', body: 'short' }, { name: 'a.bmp', size: 5, type: 'image/bmp' });
    expect(Object.keys(errors).sort()).toEqual(['body', 'image', 'rating', 'title']);
  });

  it('returns nothing for a valid review', () => {
    expect(validateReviewValues({ rating: '4', title: 'Good', body: 'This works really well for me.' }, null)).toEqual({});
  });
});

describe('formatFileSize', () => {
  it('shows bytes, KB and MB', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
