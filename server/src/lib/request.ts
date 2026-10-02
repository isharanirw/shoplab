import type { Request } from 'express';

/** The JSON body as an object, or an empty object when it is missing or not an object. */
export function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
}
