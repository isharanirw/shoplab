import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { boundaryOf, parseMultipart } from './multipart';

const B = 'XBOUNDARYX';

function body(parts: string[]): Buffer {
  return Buffer.from(parts.map((p) => `--${B}\r\n${p}\r\n`).join('') + `--${B}--\r\n`, 'latin1');
}

describe('boundaryOf', () => {
  it('reads the boundary, quoted or not', () => {
    expect(boundaryOf('multipart/form-data; boundary=abc123')).toBe('abc123');
    expect(boundaryOf('multipart/form-data; boundary="a b"')).toBe('a b');
  });
  it('returns null for other content types or a missing boundary', () => {
    expect(boundaryOf('application/json')).toBeNull();
    expect(boundaryOf('multipart/form-data')).toBeNull();
    expect(boundaryOf(undefined)).toBeNull();
  });
});

describe('parseMultipart', () => {
  it('splits text fields and a file', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x0d, 0x0a, 0xff]);
    const raw = Buffer.concat([
      Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="title"\r\n\r\nGreat\r\n`),
      Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${B}--\r\n`),
    ]);
    const parsed = parseMultipart(raw, B);
    expect(parsed.fields).toEqual({ title: 'Great' });
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({ field: 'image', filename: 'a.png', contentType: 'image/png' });
    expect(parsed.files[0]!.data.equals(png)).toBe(true);
  });

  it('keeps line breaks inside text values and handles an empty file part', () => {
    const parsed = parseMultipart(
      body([
        'Content-Disposition: form-data; name="body"\r\n\r\nline one\r\nline two',
        'Content-Disposition: form-data; name="image"; filename=""\r\nContent-Type: application/octet-stream\r\n\r\n',
      ]),
      B,
    );
    expect(parsed.fields.body).toBe('line one\r\nline two');
    expect(parsed.files[0]).toMatchObject({ filename: '' });
    expect(parsed.files[0]!.data.length).toBe(0);
  });

  it('throws a 400 for a body that is not multipart', () => {
    for (const bad of [Buffer.from('hello'), Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="a"\r\n\r\nno end`)]) {
      try {
        parseMultipart(bad, B);
        throw new Error('expected failure');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
      }
    }
  });
});
