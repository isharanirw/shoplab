import { Router } from 'express';
import type { AppContext } from '../context';
import { parseIdParam, parseProductQuery, parseReviewQuery, parseSuggestQuery } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { categoryInfo, getProduct, listProducts, listReviews, suggestProducts } from '../services/catalogue';

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

  return router;
}
