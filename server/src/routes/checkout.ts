import { Router } from 'express';
import type { AppContext } from '../context';
import { parseIdParam } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { bodyOf } from '../lib/request';
import { requireAuth } from '../middleware/auth';
import { getOrderForUser, placeOrder } from '../services/orders';
import { quoteCheckout } from '../services/quote';
import { listAddresses, listCountries } from '../services/locations';

export function checkoutRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/quote', (req, res) => {
    res.json(quoteCheckout(ctx.db, req.user!.id, bodyOf(req)));
  });
  return router;
}

export function ordersRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const { order } = placeOrder(ctx.db, req.user!.id, bodyOf(req));
    res.status(201).json(order);
  });

  router.get('/:id', (req, res) => {
    const id = parseIdParam(req.params.id);
    const order = getOrderForUser(ctx.db, req.user!.id, id);
    if (!order) throw new ApiError('NOT_FOUND', 'Order not found.');
    res.json(order);
  });

  return router;
}

export function countriesRouter(ctx: AppContext): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const data = listCountries(ctx.db);
    res.json({ data, page: 1, pageSize: data.length, total: data.length });
  });
  return router;
}

export function addressesRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', (req, res) => {
    res.json(listAddresses(ctx.db, req.user!.id));
  });
  return router;
}
