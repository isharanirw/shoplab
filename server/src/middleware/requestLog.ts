import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Assigns a request ID (reusing a sane incoming X-Request-Id) and logs one line per response. */
export function requestLog(enabled: boolean): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID().slice(0, 8);
    res.setHeader('X-Request-Id', req.id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (!enabled) return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const user = req.user ? ` user=${req.user.id}` : '';
      process.stdout.write(
        `${new Date().toISOString()} req=${req.id} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms${user}\n`,
      );
    });
    next();
  };
}
