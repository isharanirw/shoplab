import { Router } from 'express';
import type { Request } from 'express';
import type { AppContext } from '../context';
import { parseIdParam, parseProductQuery, parseReviewQuery, parseSuggestQuery } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { MAX_IMAGE_BYTES } from '../lib/imageUpload';
import { boundaryOf, parseMultipart, readRawBody } from '../lib/multipart';
import type { MultipartBody } from '../lib/multipart';
import { requireAuth } from '../middleware/auth';
import { categoryInfo, getProduct, listProducts, listReviews, suggestProducts } from '../services/catalogue';
import { postReview, productExists, reviewEligibility } from '../services/reviews';

/** Room for the text fields and multipart framing on top of the largest allowed image. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

async function readReviewForm(req: Request): Promise<MultipartBody> {
  const boundary = boundaryOf(req.header('content-type'));
  if (!boundary) throw new ApiError('VALIDATION_ERROR', 'Send the review as multipart/form-data.');
  const { tooLarge, body } = await readRawBody(req, MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES);
  if (tooLarge) {
    const message = 'The upload is too large. The image must be 2 MB or smaller.';
    throw new ApiError('PAYLOAD_TOO_LARGE', message, { fieldErrors: { image: message } });
  }
  return parseMultipart(body, boundary);
}

export function productsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const query = parseProductQuery(req.query, categoryInfo(ctx.db));
    res.json(listProducts(ctx.db, query));
  });

  router.get('/suggest', (req, res) => {
    res.json(suggestProducts(ctx.db, parseSuggestQuery(req.query)));
  });

  router.get('/:id', (req, res) => {
    const id = parseIdParam(req.params.id);
    const product = getProduct(ctx.db, id);
    if (!product) throw new ApiError('NOT_FOUND', 'Product not found.');
    res.json(product);
  });

  router.get('/:id/reviews', (req, res) => {
    const id = parseIdParam(req.params.id);
    const result = listReviews(ctx.db, id, parseReviewQuery(req.query));
    if (!result) throw new ApiError('NOT_FOUND', 'Product not found.');
    res.json(result);
  });

  /** Whether the caller may post a review. Always 200 for a real product, including for logged-out callers. */
  router.get('/:id/review-eligibility', (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!productExists(ctx.db, id)) throw new ApiError('NOT_FOUND', 'Product not found.');
    if (!req.user) {
      res.json({ eligible: false, reason: 'login_required' });
      return;
    }
    res.json(reviewEligibility(ctx.db, req.user.id, id));
  });

  router.post('/:id/reviews', requireAuth, async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!productExists(ctx.db, id)) throw new ApiError('NOT_FOUND', 'Product not found.');
    const form = await readReviewForm(req);
    const files = form.files.filter((f) => f.field === 'image' && !(f.filename === '' && f.data.length === 0));
    if (files.length > 1) {
      throw new ApiError('VALIDATION_ERROR', 'Send at most one image.', { fieldErrors: { image: 'Send at most one image.' } });
    }
    const review = postReview(
      ctx.db,
      ctx.config.uploadsDir,
      { id: req.user!.id, name: req.user!.name },
      id,
      { fields: form.fields, image: files[0]?.data ?? null },
    );
    res.status(201).json(review);
  });

  return router;
}
