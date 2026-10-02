import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Express, RequestHandler } from 'express';
import type { Config } from './config';
import type { AppContext } from './context';
import type { Db } from './db/connection';
import { FailureLimiter } from './lib/rateLimiter';
import { authenticate } from './middleware/auth';
import { apiNotFound, errorHandler } from './middleware/errorHandler';
import { requestLog } from './middleware/requestLog';
import { authRouter } from './routes/auth';
import { cartRouter } from './routes/cart';
import { contactRouter } from './routes/contact';
import { categoriesRouter, promotionsRouter } from './routes/catalogue';
import { adminRouter } from './routes/admin';
import { docsRouter } from './routes/docs';
import { geoRouter } from './routes/geo';
import { addressesRouter, checkoutRouter, countriesRouter, ordersRouter } from './routes/checkout';
import { healthRouter } from './routes/health';
import { productsRouter } from './routes/products';
import { wishlistRouter } from './routes/wishlist';
import { testRouter } from './testability/routes';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 60_000;

export function createContext(config: Config, db: Db): AppContext {
  return {
    config,
    db,
    loginLimiter: new FailureLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS),
    startedAt: Date.now(),
  };
}

/** Serves the built client and falls back to index.html for client-side routes. */
function clientHandlers(distDir: string): RequestHandler[] {
  const indexFile = path.join(distDir, 'index.html');
  const fallback: RequestHandler = (req, res, next) => {
    const isPageRequest = (req.method === 'GET' || req.method === 'HEAD') && !path.extname(req.path);
    const reserved = /^\/(api|ads|analytics)(\/|$)/.test(req.path);
    if (!isPageRequest || reserved) {
      next();
      return;
    }
    if (!fs.existsSync(indexFile)) {
      res.status(503).type('text').send('The client has not been built. Run "npm run build" first.');
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  };
  return [express.static(distDir, { index: false, maxAge: '1h' }), fallback];
}

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestLog(ctx.config.logRequests));
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // API docs sit outside the JSON API router: they need no session and answer in HTML, YAML and JavaScript.
  app.use('/api/docs', docsRouter(ctx));

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(authenticate(ctx));
  api.use('/health', healthRouter(ctx));
  api.use('/auth', authRouter(ctx));
  api.use('/products', productsRouter(ctx));
  api.use('/categories', categoriesRouter(ctx));
  api.use('/promotions', promotionsRouter());
  api.use('/wishlist', wishlistRouter(ctx));
  api.use('/cart', cartRouter(ctx));
  api.use('/checkout', checkoutRouter(ctx));
  api.use('/orders', ordersRouter(ctx));
  api.use('/countries', countriesRouter(ctx));
  api.use('/addresses', addressesRouter(ctx));
  api.use('/contact', contactRouter(ctx));
  api.use('/geo', geoRouter(ctx));
  api.use('/admin', adminRouter(ctx));
  api.use('/test', testRouter(ctx));
  api.use(apiNotFound);
  app.use('/api', api);

  app.use(
    '/uploads',
    express.static(ctx.config.uploadsDir, {
      index: false,
      maxAge: '1h',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.use(...clientHandlers(ctx.config.clientDistDir));
  app.use((req, res, next) => {
    if (/^\/(api|ads|analytics)(\/|$)/.test(req.path) || path.extname(req.path)) {
      res.status(404).type('text').send('Not found');
      return;
    }
    next();
  });

  app.use(errorHandler);
  return app;
}
