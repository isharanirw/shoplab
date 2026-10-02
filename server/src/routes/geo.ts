import { Router } from 'express';
import type { AppContext } from '../context';
import { resolveGeoCountry } from '../lib/geo';
import { listCountries } from '../services/locations';

export function geoRouter(ctx: AppContext): Router {
  const router = Router();
  router.get('/', (req, res) => {
    res.json(resolveGeoCountry(req.query.country, listCountries(ctx.db)));
  });
  return router;
}
