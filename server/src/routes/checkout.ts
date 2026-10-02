import { Router } from 'express';
import type { AppContext } from '../context';
import { parseIdParam } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { bodyOf } from '../lib/request';
import { requireAuth } from '../middleware/auth';
import { parseOrderListQuery } from '../lib/orderQuery';
import { createAddress, deleteAddress, updateAddress } from '../services/addressBook';
import { cancelOrder, getOrderForUser, listOrdersForUser, placeOrder } from '../services/orders';
import { quoteCheckout } from '../services/quote';
import { findAddress, listAddresses, listCountries } from '../services/locations';
import { f09 } from '../testability/variants';

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

  router.get('/', (req, res) => {
    res.json(listOrdersForUser(ctx.db, req.user!.id, parseOrderListQuery(req.query)));
  });

  router.get('/:id', (req, res) => {
    const id = parseIdParam(req.params.id);
    const order = getOrderForUser(ctx.db, req.user!.id, id);
    if (!order) throw new ApiError('NOT_FOUND', 'Order not found.');
    res.json(order);
  });

  router.post('/:id/cancel', (req, res) => {
    res.json(cancelOrder(ctx.db, req.user!.id, parseIdParam(req.params.id)));
  });

  return router;
}

export function countriesRouter(ctx: AppContext): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const data = listCountries(ctx.db).map((c) => ({ ...c, postalPattern: f09(c.postalPattern) }));
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
  router.get('/:id', (req, res) => {
    const address = findAddress(ctx.db, req.user!.id, parseIdParam(req.params.id));
    if (!address) throw new ApiError('NOT_FOUND', 'Address not found.');
    res.json(address);
  });
  router.post('/', (req, res) => {
    res.status(201).json(createAddress(ctx.db, req.user!.id, bodyOf(req)));
  });
  router.patch('/:id', (req, res) => {
    res.json(updateAddress(ctx.db, req.user!.id, parseIdParam(req.params.id), bodyOf(req)));
  });
  router.delete('/:id', (req, res) => {
    deleteAddress(ctx.db, req.user!.id, parseIdParam(req.params.id));
    res.status(204).end();
  });
  return router;
}
