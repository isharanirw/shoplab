import { Router } from 'express';
import type { AppContext } from '../context';
import { listCategories } from '../services/catalogue';

/** Fixed text for the home banner; it never changes, so tests can rely on it. */
export const PROMOTIONS = {
  bannerText: 'Free standard shipping on orders of $100 or more.',
  flashSaleLabel: 'Flash sale: extra savings on selected items',
} as const;

export function categoriesRouter(ctx: AppContext): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ data: listCategories(ctx.db) });
  });
  return router;
}

export function promotionsRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(PROMOTIONS);
  });
  return router;
}
