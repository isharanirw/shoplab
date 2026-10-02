import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AppContext, AuthUser } from '../context';
import { ApiError } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/passwords';
import { normaliseEmail, validateName, validateRegistration } from '../lib/validation';
import { SESSION_COOKIE, requireAuth } from '../middleware/auth';
import { createSession, deleteSession } from '../services/sessions';
import { f04, f18 } from '../testability/variants';

const DUMMY_HASH = hashPassword('Dummy@1234');

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
}

function startSession(ctx: AppContext, req: Request, res: Response, user: AuthUser, rememberMe: boolean) {
  const session = createSession(ctx.db, user.id, rememberMe);
  res.cookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: '/',
    maxAge: session.ttlMs,
  });
  return { token: session.token, user, expiresAt: session.expiresAt };
}

export function authRouter(ctx: AppContext): Router {
  const router = Router();

  router.post('/register', (req, res) => {
    const body = bodyOf(req);
    const fieldErrors = validateRegistration(body);
    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors });
    }
    const email = normaliseEmail(body.email as string);
    const name = (body.name as string).trim();
    const exists = ctx.db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (exists) {
      throw new ApiError('CONFLICT', 'An account with this email already exists.', {
        fieldErrors: { email: 'This email is already registered.' },
      });
    }
    const info = ctx.db
      .prepare('INSERT INTO users (name, email, password_hash, role, locked, created_at) VALUES (?, ?, ?, ?, 0, ?)')
      .run(name, email, hashPassword(body.password as string), 'customer', new Date().toISOString());
    const user: AuthUser = { id: Number(info.lastInsertRowid), name, email, role: 'customer' };
    res.status(f18(201)).json(startSession(ctx, req, res, user, body.rememberMe === true));
  });

  router.post('/login', (req, res) => {
    const body = bodyOf(req);
    const fieldErrors: Record<string, string> = {};
    if (typeof body.email !== 'string' || body.email.trim() === '') fieldErrors.email = 'Email is required.';
    if (typeof body.password !== 'string' || body.password === '') fieldErrors.password = 'Password is required.';
    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError('VALIDATION_ERROR', 'Email and password are required.', { fieldErrors });
    }
    const email = normaliseEmail(body.email as string);
    const password = body.password as string;
    const limiterKey = `${req.ip ?? 'unknown'}|${email}`;

    if (ctx.loginLimiter.isBlocked(limiterKey)) {
      const retryAfter = ctx.loginLimiter.retryAfterSeconds(limiterKey);
      throw new ApiError('RATE_LIMITED', 'Too many failed login attempts. Please wait a minute and try again.', {
        headers: { 'Retry-After': String(retryAfter) },
      });
    }

    const row = ctx.db
      .prepare('SELECT id, name, email, role, locked, password_hash FROM users WHERE email = ?')
      .get(email) as (AuthUser & { locked: number; password_hash: string }) | undefined;
    const passwordOk = verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !passwordOk) {
      ctx.loginLimiter.recordFailure(limiterKey);
      throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    if (row.locked) {
      throw new ApiError('ACCOUNT_LOCKED', 'This account has been locked. Please contact support.');
    }

    ctx.loginLimiter.clearKey(limiterKey);
    const user: AuthUser = { id: row.id, name: row.name, email: row.email, role: row.role };
    res.json(startSession(ctx, req, res, user, body.rememberMe === true));
  });

  router.post('/logout', requireAuth, (req, res) => {
    if (req.sessionToken && !f04()) deleteSession(ctx.db, req.sessionToken);
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  router.patch('/me', requireAuth, (req, res) => {
    const body = bodyOf(req);
    const nameErr = typeof body.name === 'string' ? validateName(body.name) : 'Name is required.';
    if (nameErr) {
      throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors: { name: nameErr } });
    }
    const name = (body.name as string).trim();
    ctx.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user!.id);
    res.json({ user: { ...req.user!, name } });
  });

  return router;
}
