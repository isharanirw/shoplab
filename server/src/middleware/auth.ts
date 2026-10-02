import type { RequestHandler } from 'express';
import type { AppContext } from '../context';
import { ApiError } from '../lib/errors';
import { findSessionUser } from '../services/sessions';

export const SESSION_COOKIE = 'shoplab_session';

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Reads the session token from `Authorization: Bearer` first, then from the cookie. */
export function extractToken(authorization: string | undefined, cookieHeader: string | undefined): string | undefined {
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
    return match?.[1];
  }
  return readCookie(cookieHeader, SESSION_COOKIE);
}

/** Resolves req.user from either credential; leaves it unset when there is no valid session. */
export function authenticate(ctx: AppContext): RequestHandler {
  return (req, _res, next) => {
    const token = extractToken(req.header('authorization'), req.header('cookie'));
    if (token) {
      const user = findSessionUser(ctx.db, token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new ApiError('UNAUTHENTICATED', 'You need to log in to do that.');
  next();
};

/** Admin-only routes: 401 without a session, 403 for a logged-in customer. Use after (or instead of) requireAuth. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new ApiError('UNAUTHENTICATED', 'You need to log in to do that.');
  if (req.user.role !== 'admin') throw new ApiError('FORBIDDEN', 'You do not have permission to do that.');
  next();
};
