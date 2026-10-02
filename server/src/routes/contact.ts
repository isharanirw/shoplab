import { Router } from 'express';
import type { AppContext } from '../context';
import { bodyOf } from '../lib/request';
import { saveContactMessage } from '../services/contact';

export function contactRouter(ctx: AppContext): Router {
  const router = Router();
  router.post('/', (req, res) => {
    const id = saveContactMessage(ctx.db, req.user?.id ?? null, bodyOf(req));
    res.status(201).json({ id, message: 'Thanks, your message was received. This is a demo, so no email is sent.' });
  });
  return router;
}
