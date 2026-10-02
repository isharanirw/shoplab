import { Router } from 'express';
import type { AppContext } from '../context';
import { parseIdParam, parseProductQuery, parseReviewQuery, parseSuggestQuery } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { categoryInfo, getProduct, listProducts, listReviews, suggestProducts } from '../services/catalogue';
import { postReview, productExists, reviewEligibility } from '../services/reviews';
import { imageFileOf, readImageForm } from './imageForm';

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
    const form = await readImageForm(req, 'Send the review as multipart/form-data.');
    const review = postReview(
      ctx.db,
      ctx.config.uploadsDir,
      { id: req.user!.id, name: req.user!.name },
      id,
      { fields: form.fields, image: imageFileOf(form) },
    );
    res.status(201).json(review);
  });

  return router;
}
