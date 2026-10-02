import { Router } from 'express';
import type { AppContext } from '../context';
import { parseAdminOrderQuery, parseAdminProductQuery, parseAdminUserQuery } from '../lib/adminQuery';
import { parseIdParam } from '../lib/catalogueQuery';
import { ApiError } from '../lib/errors';
import { coerceFormFields } from '../lib/productRules';
import { bodyOf } from '../lib/request';
import { requireAdmin } from '../middleware/auth';
import { changeOrderStatus, listAdminOrders } from '../services/adminOrders';
import { createProduct, deleteProduct, getAdminProduct, listAdminProducts, updateProduct } from '../services/adminProducts';
import { listAdminUsers, setUserLocked } from '../services/adminUsers';
import { imageFileOf, isMultipart, readImageForm } from './imageForm';
import type { Request } from 'express';

/** Product fields and the optional image from either a JSON body or a multipart form. */
async function readProductRequest(req: Request): Promise<{ fields: Record<string, unknown>; image: Buffer | null }> {
  if (!isMultipart(req)) return { fields: bodyOf(req), image: null };
  const form = await readImageForm(req, 'Send the product as JSON or multipart/form-data.');
  return { fields: coerceFormFields(form.fields), image: imageFileOf(form) };
}

export function adminRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/products', (req, res) => {
    res.json(listAdminProducts(ctx.db, parseAdminProductQuery(req.query)));
  });

  router.get('/products/:id', (req, res) => {
    const product = getAdminProduct(ctx.db, parseIdParam(req.params.id));
    if (!product) throw new ApiError('NOT_FOUND', 'Product not found.');
    res.json(product);
  });

  router.post('/products', async (req, res) => {
    const { fields, image } = await readProductRequest(req);
    res.status(201).json(createProduct(ctx.db, ctx.config.uploadsDir, fields, image));
  });

  router.patch('/products/:id', async (req, res) => {
    const id = parseIdParam(req.params.id);
    const { fields, image } = await readProductRequest(req);
    res.json(updateProduct(ctx.db, ctx.config.uploadsDir, id, fields, image));
  });

  router.delete('/products/:id', (req, res) => {
    deleteProduct(ctx.db, ctx.config.uploadsDir, parseIdParam(req.params.id));
    res.status(204).end();
  });

  router.get('/orders', (req, res) => {
    res.json(listAdminOrders(ctx.db, parseAdminOrderQuery(req.query)));
  });

  router.patch('/orders/:id/status', (req, res) => {
    res.json(changeOrderStatus(ctx.db, parseIdParam(req.params.id), bodyOf(req).status));
  });

  router.get('/users', (req, res) => {
    res.json(listAdminUsers(ctx.db, parseAdminUserQuery(req.query)));
  });

  router.patch('/users/:id/lock', (req, res) => {
    res.json(setUserLocked(ctx.db, req.user!.id, parseIdParam(req.params.id), bodyOf(req).locked));
  });

  return router;
}
