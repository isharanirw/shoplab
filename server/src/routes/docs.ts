import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import type { AppContext } from '../context';

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>ShopLab API docs</title>
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/swagger-init.js"></script>
</body>
</html>
`;

// Kept in a file of its own (not inline) so the page works under a strict script policy too.
const INIT_SCRIPT = `window.addEventListener('load', function () {
  window.ui = SwaggerUIBundle({
    url: '/api/docs/openapi.yaml',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout'
  });
});
`;

/** Where the bundled Swagger UI files live (the swagger-ui-dist package, so nothing is loaded from a CDN). */
function swaggerAssetsDir(): string {
  return path.dirname(require.resolve('swagger-ui-dist/package.json'));
}

/**
 * Swagger UI at /api/docs, the raw spec at /api/docs/openapi.yaml, and the UI's own files under /api/docs/assets.
 * Everything is served from files in the app; the browser makes no request to another site.
 */
export function docsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.type('html').send(PAGE);
  });
  router.get('/swagger-init.js', (_req, res) => {
    res.type('application/javascript').send(INIT_SCRIPT);
  });
  router.get('/openapi.yaml', (_req, res) => {
    if (!fs.existsSync(ctx.config.openApiPath)) {
      res.status(404).type('text').send('The OpenAPI document was not found.');
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/yaml').send(fs.readFileSync(ctx.config.openApiPath, 'utf8'));
  });
  router.use(
    '/assets',
    express.static(swaggerAssetsDir(), {
      index: false,
      maxAge: '1h',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
  return router;
}
