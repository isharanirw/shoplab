import type { Request } from 'express';
import { ApiError } from '../lib/errors';
import { MAX_IMAGE_BYTES } from '../lib/imageUpload';
import { boundaryOf, parseMultipart, readRawBody } from '../lib/multipart';
import type { MultipartBody } from '../lib/multipart';

/** Room for the text fields and multipart framing on top of the largest allowed image. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export function isMultipart(req: Request): boolean {
  return boundaryOf(req.header('content-type')) !== null;
}

/**
 * Reads a multipart/form-data body that may carry one image (limit 2 MB plus form overhead). A body over the
 * limit is a 413 with `fieldErrors.image`; a body that is not multipart is a 400 with `notMultipartMessage`.
 */
export async function readImageForm(req: Request, notMultipartMessage: string): Promise<MultipartBody> {
  const boundary = boundaryOf(req.header('content-type'));
  if (!boundary) throw new ApiError('VALIDATION_ERROR', notMultipartMessage);
  const { tooLarge, body } = await readRawBody(req, MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES);
  if (tooLarge) {
    const message = 'The upload is too large. The image must be 2 MB or smaller.';
    throw new ApiError('PAYLOAD_TOO_LARGE', message, { fieldErrors: { image: message } });
  }
  return parseMultipart(body, boundary);
}

/** The single `image` file of a form (an untouched, empty file input counts as none). More than one is a 400. */
export function imageFileOf(form: MultipartBody): Buffer | null {
  const files = form.files.filter((f) => f.field === 'image' && !(f.filename === '' && f.data.length === 0));
  if (files.length > 1) {
    throw new ApiError('VALIDATION_ERROR', 'Send at most one image.', { fieldErrors: { image: 'Send at most one image.' } });
  }
  return files[0]?.data ?? null;
}
