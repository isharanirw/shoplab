import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** When a key is configured, every request must carry it in X-Test-Key. Without a key the routes are open. */
export function requireTestKey(key: string | null): RequestHandler {
  return (req, _res, next) => {
    if (key === null) {
      next();
      return;
    }
    const provided = req.header('x-test-key');
    if (!provided || !safeEqual(provided, key)) {
      throw new ApiError('UNAUTHENTICATED', 'A valid X-Test-Key header is required.');
    }
    next();
  };
}
