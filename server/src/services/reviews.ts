import type { Db } from '../db/connection';
import { ApiError } from '../lib/errors';
import { checkImage } from '../lib/imageUpload';
import { validateReviewFields } from '../lib/reviewRules';
import type { Review } from './catalogue';
import { deleteReviewImage, saveReviewImage } from './uploads';

export type EligibilityReason = 'not_purchased' | 'already_reviewed';

export interface Eligibility {
  eligible: boolean;
  /** Why the user cannot review: 'login_required' is added by the route for logged-out callers. */
  reason: EligibilityReason | 'login_required' | null;
}

/**
 * A user may review a product when they have an order containing it that is not Cancelled
 * (Processing, Shipped and Delivered all count), and they have not reviewed it yet.
 * Purchased is checked first, so a non-buyer is told that before anything else.
 */
export function reviewEligibility(db: Db, userId: number, productId: number): Eligibility {
  const purchased = db
    .prepare(
      `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = ? AND i.product_id = ? AND o.status <> 'Cancelled' LIMIT 1`,
    )
    .get(userId, productId);
  if (!purchased) return { eligible: false, reason: 'not_purchased' };
  const existing = db.prepare('SELECT 1 FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1').get(userId, productId);
  if (existing) return { eligible: false, reason: 'already_reviewed' };
  return { eligible: true, reason: null };
}

export function productExists(db: Db, productId: number): boolean {
  return db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(productId) !== undefined;
}

export interface ReviewSubmission {
  /** Text parts of the multipart form: rating, title, body. */
  fields: Record<string, string | undefined>;
  /** The uploaded file, or null when none was chosen. */
  image: Buffer | null;
}

/**
 * Posts a review. Order of checks: unknown product (404), not a buyer (403), already reviewed (409),
 * image over 2 MB (413), then every field problem at once (400 with `fieldErrors`: rating, title, body, image).
 * The image is only written to disk once everything else has passed, and removed again if the insert fails.
 */
export function postReview(
  db: Db,
  uploadsDir: string,
  user: { id: number; name: string },
  productId: number,
  submission: ReviewSubmission,
  now: Date = new Date(),
): Review {
  if (!productExists(db, productId)) throw new ApiError('NOT_FOUND', 'Product not found.');
  assertCanReview(db, user.id, productId);

  const imageCheck = submission.image ? checkImage(submission.image) : null;
  if (imageCheck && !imageCheck.ok && imageCheck.reason === 'too_large') {
    throw new ApiError('PAYLOAD_TOO_LARGE', imageCheck.message, { fieldErrors: { image: imageCheck.message } });
  }

  const parsed = validateReviewFields(submission.fields);
  const fieldErrors = parsed.ok ? {} : { ...parsed.fieldErrors };
  if (imageCheck && !imageCheck.ok) fieldErrors.image = imageCheck.message;
  if (!parsed.ok || Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors });
  }

  let imagePath: string | null = null;
  if (submission.image && imageCheck?.ok) imagePath = saveReviewImage(uploadsDir, submission.image, imageCheck.type);
  try {
    return createReview(db, user, productId, parsed.fields, imagePath, now);
  } catch (err) {
    if (imagePath) deleteReviewImage(uploadsDir, imagePath);
    throw err;
  }
}

/** Throws 403 when the user has not bought the product and 409 when they already reviewed it. */
export function assertCanReview(db: Db, userId: number, productId: number): void {
  const eligibility = reviewEligibility(db, userId, productId);
  if (eligibility.reason === 'not_purchased') {
    throw new ApiError('FORBIDDEN', 'Only customers who have bought this product can review it.');
  }
  if (eligibility.reason === 'already_reviewed') {
    throw new ApiError('CONFLICT', 'You have already reviewed this product.');
  }
}

export function createReview(
  db: Db,
  user: { id: number; name: string },
  productId: number,
  fields: { rating: number; title: string; body: string },
  imagePath: string | null,
  now: Date = new Date(),
): Review {
  const createdAt = now.toISOString();
  const info = db
    .prepare(
      `INSERT INTO reviews (product_id, user_id, author_name, rating, title, body, image_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(productId, user.id, user.name, fields.rating, fields.title, fields.body, imagePath, createdAt);
  return {
    id: Number(info.lastInsertRowid),
    authorName: user.name,
    rating: fields.rating,
    title: fields.title,
    body: fields.body,
    imagePath,
    createdAt,
  };
}
