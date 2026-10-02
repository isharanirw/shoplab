export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export type ImageType = 'png' | 'jpeg';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(data: Uint8Array, signature: number[]): boolean {
  return data.length >= signature.length && signature.every((byte, i) => data[i] === byte);
}

/** Detects PNG or JPEG from the first bytes of the file. The file name and the declared MIME type are never trusted. */
export function sniffImageType(data: Uint8Array): ImageType | null {
  if (startsWith(data, PNG_SIGNATURE)) return 'png';
  if (startsWith(data, JPEG_SIGNATURE)) return 'jpeg';
  return null;
}

export const IMAGE_EXTENSION: Record<ImageType, string> = { png: 'png', jpeg: 'jpg' };

export type ImageCheck =
  | { ok: true; type: ImageType }
  | { ok: false; reason: 'too_large' | 'empty' | 'bad_type'; message: string };

/** Checks size first (so a huge file is rejected without being inspected), then the real file type. */
export function checkImage(data: Uint8Array): ImageCheck {
  if (data.length > MAX_IMAGE_BYTES) return { ok: false, reason: 'too_large', message: 'The image must be 2 MB or smaller.' };
  if (data.length === 0) return { ok: false, reason: 'empty', message: 'The image file is empty.' };
  const type = sniffImageType(data);
  if (!type) return { ok: false, reason: 'bad_type', message: 'The image must be a PNG or JPG file.' };
  return { ok: true, type };
}
