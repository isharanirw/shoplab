import { describe, expect, it } from 'vitest';
import { checkImage, MAX_IMAGE_BYTES, sniffImageType } from './imageUpload';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];

describe('sniffImageType', () => {
  it('recognises PNG and JPEG by their first bytes', () => {
    expect(sniffImageType(Uint8Array.from(PNG))).toBe('png');
    expect(sniffImageType(Uint8Array.from(JPG))).toBe('jpeg');
  });

  it('rejects GIF, text, HTML, and files that are too short', () => {
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<html></html>'))).toBeNull();
    expect(sniffImageType(Uint8Array.from([0x89, 0x50]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe('checkImage', () => {
  it('accepts a valid PNG and JPEG', () => {
    expect(checkImage(Uint8Array.from(PNG))).toEqual({ ok: true, type: 'png' });
    expect(checkImage(Uint8Array.from(JPG))).toEqual({ ok: true, type: 'jpeg' });
  });

  it('accepts a file of exactly 2 MB and rejects one byte more', () => {
    const exact = Buffer.alloc(MAX_IMAGE_BYTES);
    Buffer.from(PNG).copy(exact);
    expect(checkImage(exact).ok).toBe(true);
    const over = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    Buffer.from(PNG).copy(over);
    expect(checkImage(over)).toMatchObject({ ok: false, reason: 'too_large' });
  });

  it('rejects an empty file and a file whose content is not an image', () => {
    expect(checkImage(new Uint8Array())).toMatchObject({ ok: false, reason: 'empty' });
    expect(checkImage(Buffer.from('not an image at all'))).toMatchObject({ ok: false, reason: 'bad_type' });
  });
});
