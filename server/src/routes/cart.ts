import { Router } from 'express';
import type { AppContext } from '../context';
import { parseIdParam } from '../lib/catalogueQuery';
import { bodyOf } from '../lib/request';
import { requireAuth } from '../middleware/auth';
import { addItem, applyCoupon, clearCart, getCart, mergeGuestCart, removeCoupon, removeItem, setItemQuantity } from '../services/cart';
import { f05 } from '../testability/variants';

export function cartRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(getCart(ctx.db, req.user!.id));
  });

  router.delete('/', (req, res) => {
    clearCart(ctx.db, req.user!.id);
    res.json(getCart(ctx.db, req.user!.id));
  });

  router.post('/items', (req, res) => {
    const { created } = addItem(ctx.db, req.user!.id, bodyOf(req) as { productId: unknown; quantity: unknown; variantId?: unknown });
    res.status(f05(created ? 201 : 200)).json(getCart(ctx.db, req.user!.id));
  });

  router.patch('/items/:itemId', (req, res) => {
    const itemId = parseIdParam(req.params.itemId, 'itemId');
    setItemQuantity(ctx.db, req.user!.id, itemId, bodyOf(req).quantity);
    res.json(getCart(ctx.db, req.user!.id));
  });

  router.delete('/items/:itemId', (req, res) => {
    const itemId = parseIdParam(req.params.itemId, 'itemId');
    removeItem(ctx.db, req.user!.id, itemId);
    res.json(getCart(ctx.db, req.user!.id));
  });

  router.post('/coupon', (req, res) => {
    applyCoupon(ctx.db, req.user!.id, bodyOf(req).code);
    res.json(getCart(ctx.db, req.user!.id));
  });

  router.delete('/coupon', (req, res) => {
    removeCoupon(ctx.db, req.user!.id);
    res.json(getCart(ctx.db, req.user!.id));
  });

  router.post('/merge', (req, res) => {
    const adjustments = mergeGuestCart(ctx.db, req.user!.id, bodyOf(req).items);
    res.json({ cart: getCart(ctx.db, req.user!.id), adjustments });
  });

  return router;
}
