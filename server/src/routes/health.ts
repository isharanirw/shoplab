import { Router } from 'express';
import type { AppContext } from '../context';
import { f24 } from '../testability/variants';

export function healthRouter(ctx: AppContext): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(
      f24({
        status: 'ok',
        version: ctx.config.version,
        uptimeSeconds: Math.floor((Date.now() - ctx.startedAt) / 1000),
      }),
    );
  });
  return router;
}
