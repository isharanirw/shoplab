import { Router } from 'express';
import { activeFlags } from './flags';

/** Public, read only: the client reads the active flag IDs once when it starts. */
export function configRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ flags: activeFlags() });
  });
  return router;
}
