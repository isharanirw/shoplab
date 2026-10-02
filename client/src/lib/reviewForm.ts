export const REVIEW_TITLE_MIN = 3;
export const REVIEW_TITLE_MAX = 100;
export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 2000;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export interface ReviewFormValues {
  rating: string;
  title: string;
  body: string;
}

export type ReviewField = 'rating' | 'title' | 'body' | 'image';
export type ReviewErrors = Partial<Record<ReviewField, string>>;

// These messages match the ones the API returns, so inline errors read the same either way.
export function validateRating(rating: string): string | null {
  return /^[1-5]$/.test(rating) ? null : 'Choose a rating from 1 to 5.';
}

export function validateTitle(value: string): string | null {
  const title = value.trim();
  if (title === '') return 'Title is required.';
  if (title.length < REVIEW_TITLE_MIN) return `Title must be at least ${REVIEW_TITLE_MIN} characters.`;
  if (title.length > REVIEW_TITLE_MAX) return `Title must be at most ${REVIEW_TITLE_MAX} characters.`;
  return null;
}

export function validateBody(value: string): string | null {
  const body = value.trim();
  if (body === '') return 'Review text is required.';
  if (body.length < REVIEW_BODY_MIN) return `Review text must be at least ${REVIEW_BODY_MIN} characters.`;
  if (body.length > REVIEW_BODY_MAX) return `Review text must be at most ${REVIEW_BODY_MAX} characters.`;
  return null;
}

/** Quick check of a chosen file before upload: size, then PNG or JPG by name and declared type. The server checks the real content. */
export function validateImageFile(file: { name: string; size: number; type: string } | null): string | null {
  if (!file) return null;
  if (file.size > MAX_IMAGE_BYTES) return 'The image must be 2 MB or smaller.';
  if (file.size === 0) return 'The image file is empty.';
  const extension = /\.([A-Za-z0-9]+)$/.exec(file.name)?.[1]?.toLowerCase();
  const typeOk = file.type === '' || file.type === 'image/png' || file.type === 'image/jpeg';
  const extensionOk = extension === 'png' || extension === 'jpg' || extension === 'jpeg';
  if (!typeOk || !extensionOk) return 'The image must be a PNG or JPG file.';
  return null;
}

export function validateReviewValues(values: ReviewFormValues, file: { name: string; size: number; type: string } | null): ReviewErrors {
  const errors: ReviewErrors = {};
  const rating = validateRating(values.rating);
  if (rating) errors.rating = rating;
  const title = validateTitle(values.title);
  if (title) errors.title = title;
  const body = validateBody(values.body);
  if (body) errors.body = body;
  const image = validateImageFile(file);
  if (image) errors.image = image;
  return errors;
}

/** "1.5 MB", "300 KB": the size shown next to the chosen file name. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
