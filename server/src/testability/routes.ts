import { Router } from 'express';
import type { Request } from 'express';
import type { AppContext } from '../context';
import { TABLES_IN_CREATE_ORDER } from '../db/schema';
import { isScenario, seedDatabase, SCENARIOS } from '../db/seed';
import { ApiError } from '../lib/errors';
import { hashPassword, validatePassword } from '../lib/passwords';
import { normaliseEmail, validateEmail } from '../lib/validation';
import { requireTestKey } from '../middleware/testKey';
import { getTestSettings, resetTestSettings } from './settings';

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
}

export function testRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireTestKey(ctx.config.testApiKey));

  router.post('/reset', (req, res) => {
    const { scenario = 'default' } = bodyOf(req);
    if (!isScenario(scenario)) {
      throw new ApiError('VALIDATION_ERROR', `Unknown scenario. Use one of: ${SCENARIOS.join(', ')}.`, {
        fieldErrors: { scenario: `Must be one of ${SCENARIOS.join(', ')}.` },
      });
    }
    seedDatabase(ctx.db, ctx.config.seedDir, scenario);
    ctx.loginLimiter.clearAll();
    resetTestSettings(scenario);
    res.status(204).end();
  });

  router.post('/users', (req, res) => {
    const body = bodyOf(req);
    const fieldErrors: Record<string, string> = {};
    const emailErr = typeof body.email === 'string' ? validateEmail(body.email) : 'Email is required.';
    if (emailErr) fieldErrors.email = emailErr;
    const pwErr = typeof body.password === 'string' ? validatePassword(body.password) : 'Password is required.';
    if (pwErr) fieldErrors.password = pwErr;
    const role = body.role ?? 'customer';
    if (role !== 'customer' && role !== 'admin') fieldErrors.role = 'Role must be customer or admin.';
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
      fieldErrors.name = 'Name must be a non-empty string.';
    }
    if (body.locked !== undefined && typeof body.locked !== 'boolean') fieldErrors.locked = 'Locked must be true or false.';
    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors });
    }
    const email = normaliseEmail(body.email as string);
    if (ctx.db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new ApiError('CONFLICT', 'A user with this email already exists.', {
        fieldErrors: { email: 'This email is already registered.' },
      });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : email.split('@')[0]!;
    const locked = body.locked === true ? 1 : 0;
    const info = ctx.db
      .prepare('INSERT INTO users (name, email, password_hash, role, locked, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, email, hashPassword(body.password as string), role, locked, new Date().toISOString());
    res.status(201).json({ user: { id: Number(info.lastInsertRowid), name, email, role, locked: locked === 1 } });
  });

  router.get('/state', (_req, res) => {
    const counts: Record<string, number> = {};
    for (const table of TABLES_IN_CREATE_ORDER) {
      counts[table] = (ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    }
    const settings = getTestSettings();
    res.json({
      scenario: settings.scenario,
      counts,
      flags: settings.flags,
      latency: settings.chaos,
    });
  });

  return router;
}
