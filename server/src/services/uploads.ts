import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGE_EXTENSION } from '../lib/imageUpload';
import type { ImageType } from '../lib/imageUpload';

export const REVIEW_IMAGE_URL_PREFIX = '/uploads/reviews/';

function reviewDir(uploadsDir: string): string {
  return path.join(uploadsDir, 'reviews');
}

/** Stores a review image under a generated name and returns its public URL path. */
export function saveReviewImage(uploadsDir: string, data: Buffer, type: ImageType): string {
  const dir = reviewDir(uploadsDir);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${randomUUID()}.${IMAGE_EXTENSION[type]}`;
  fs.writeFileSync(path.join(dir, name), data);
  return `${REVIEW_IMAGE_URL_PREFIX}${name}`;
}

/** Deletes a stored review image given the URL path returned by saveReviewImage. Missing files are ignored. */
export function deleteReviewImage(uploadsDir: string, urlPath: string): void {
  if (!urlPath.startsWith(REVIEW_IMAGE_URL_PREFIX)) return;
  const name = path.basename(urlPath);
  fs.rmSync(path.join(reviewDir(uploadsDir), name), { force: true });
}

/** Removes every uploaded file. Used by reset and at start-up so the files always match the (re-seeded) database. */
export function clearUploads(uploadsDir: string): void {
  fs.rmSync(reviewDir(uploadsDir), { recursive: true, force: true });
}
