import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { IMAGE_EXTENSION } from '../lib/imageUpload';
import type { ImageType } from '../lib/imageUpload';

export const REVIEW_IMAGE_URL_PREFIX = '/uploads/reviews/';
export const PRODUCT_IMAGE_URL_PREFIX = '/uploads/products/';

/** Every folder below the uploads directory that the app writes to. Reset and start-up remove all of them. */
const UPLOAD_FOLDERS = ['reviews', 'products'] as const;
type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

function folderPath(uploadsDir: string, folder: UploadFolder): string {
  return path.join(uploadsDir, folder);
}

function saveImage(uploadsDir: string, folder: UploadFolder, data: Buffer, type: ImageType): string {
  const dir = folderPath(uploadsDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${randomUUID()}.${IMAGE_EXTENSION[type]}`;
  fs.writeFileSync(path.join(dir, name), data);
  return `/uploads/${folder}/${name}`;
}

function deleteImage(uploadsDir: string, folder: UploadFolder, prefix: string, urlPath: string): void {
  if (!urlPath.startsWith(prefix)) return;
  const name = path.basename(urlPath);
  fs.rmSync(path.join(folderPath(uploadsDir, folder), name), { force: true });
}

/** Stores a review image under a generated name and returns its public URL path. */
export function saveReviewImage(uploadsDir: string, data: Buffer, type: ImageType): string {
  return saveImage(uploadsDir, 'reviews', data, type);
}

/** Deletes a stored review image given the URL path returned by saveReviewImage. Missing files are ignored. */
export function deleteReviewImage(uploadsDir: string, urlPath: string): void {
  deleteImage(uploadsDir, 'reviews', REVIEW_IMAGE_URL_PREFIX, urlPath);
}

/** Stores a product image (uploaded by an admin) under a generated name and returns its public URL path. */
export function saveProductImage(uploadsDir: string, data: Buffer, type: ImageType): string {
  return saveImage(uploadsDir, 'products', data, type);
}

/** Deletes a stored product image given its URL path. Missing files and foreign paths are ignored. */
export function deleteProductImage(uploadsDir: string, urlPath: string | null): void {
  if (urlPath) deleteImage(uploadsDir, 'products', PRODUCT_IMAGE_URL_PREFIX, urlPath);
}

/** Removes every uploaded file. Used by reset and at start-up so the files always match the (re-seeded) database. */
export function clearUploads(uploadsDir: string): void {
  for (const folder of UPLOAD_FOLDERS) fs.rmSync(folderPath(uploadsDir, folder), { recursive: true, force: true });
}
