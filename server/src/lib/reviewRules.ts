import { f25 } from '../testability/variants';
export const REVIEW_TITLE_MIN = 3;
export const REVIEW_TITLE_MAX = 100;
export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 2000;

export interface ReviewFields {
  rating: number;
  title: string;
  body: string;
}

export type ReviewFieldsResult =
  | { ok: true; fields: ReviewFields }
  | { ok: false; fieldErrors: Record<string, string> };

/** Validates the text parts of a review (all arrive as strings in a multipart form). */
export function validateReviewFields(raw: Record<string, string | undefined>): ReviewFieldsResult {
  const fieldErrors: Record<string, string> = {};

  const ratingText = (raw.rating ?? '').trim();
  const rating = /^[1-5]$/.test(ratingText) ? Number(ratingText) : null;
  if (ratingText === '') fieldErrors.rating = 'Choose a rating from 1 to 5.';
  else if (rating === null) fieldErrors.rating = 'The rating must be a whole number from 1 to 5.';

  const title = (raw.title ?? '').trim();
  if (title === '') fieldErrors.title = 'Title is required.';
  else if (title.length < REVIEW_TITLE_MIN) fieldErrors.title = `Title must be at least ${REVIEW_TITLE_MIN} characters.`;
  else if (title.length > REVIEW_TITLE_MAX) fieldErrors.title = `Title must be at most ${REVIEW_TITLE_MAX} characters.`;

  const body = (raw.body ?? '').trim();
  if (body === '') fieldErrors.body = 'Review text is required.';
  else if (body.length < f25(REVIEW_BODY_MIN)) fieldErrors.body = `Review text must be at least ${REVIEW_BODY_MIN} characters.`;
  else if (body.length > REVIEW_BODY_MAX) fieldErrors.body = `Review text must be at most ${REVIEW_BODY_MAX} characters.`;

  if (Object.keys(fieldErrors).length > 0 || rating === null) return { ok: false, fieldErrors };
  return { ok: true, fields: { rating, title, body } };
}
