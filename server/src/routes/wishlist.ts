import { Router } from 'express';
import type { Request } from 'express';
import type { AppContext } from '../context';
import { parseIdParam } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { addToWishlist, listWishlist, removeFromWishlist, reorderWishlist } from '../services/wishlist';

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
}

function productIdFromBody(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ApiError('VALIDATION_ERROR', 'productId must be a positive whole number.', {
      fieldErrors: { productId: 'Must be a positive whole number.' },
    });
  }
  return value;
}

export function wishlistRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(listWishlist(ctx.db, req.user!.id));
  });

  router.post('/', (req, res) => {
    const productId = productIdFromBody(bodyOf(req).productId);
    const result = addToWishlist(ctx.db, req.user!.id, productId);
    if (result === 'no-product') throw new ApiError('NOT_FOUND', 'Product not found.');
    res.status(result === 'added' ? 201 : 200).json({ productId });
  });

  router.put('/order', (req, res) => {
    res.json(reorderWishlist(ctx.db, req.user!.id, bodyOf(req).productIds));
  });

  router.delete('/:productId', (req, res) => {
    const productId = parseIdParam(req.params.productId, 'productId');
    if (!removeFromWishlist(ctx.db, req.user!.id, productId)) {
      throw new ApiError('NOT_FOUND', 'That product is not on your wishlist.');
    }
    res.status(204).end();
  });

  return router;
}
