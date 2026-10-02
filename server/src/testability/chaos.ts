import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors';
import type { ErrorCode } from '../lib/errors';

export type ChaosStatus = 500 | 503 | 429;

export interface ChaosSettings {
  latencyMs: number;
  jitterMs: number;
  failureRate: number;
  paths: string[];
  status: ChaosStatus;
  deterministic: boolean;
}

export const NEUTRAL_CHAOS: ChaosSettings = {
  latencyMs: 0,
  jitterMs: 0,
  failureRate: 0,
  paths: [],
  status: 503,
  deterministic: true,
};

export const CHAOS_STATUSES: readonly ChaosStatus[] = [500, 503, 429];
export const MAX_CHAOS_PATHS = 20;
/** Fixed seed for the non-deterministic mode, so a run can still be repeated by restarting the server. */
export const CHAOS_SEED = 20260102;

/** Paths chaos never touches (matched on the request path, without the query string). */
const EXCLUDED = [/^\/api\/test(\/|$)/, /^\/api\/health(\/|$)/, /^\/api\/docs(\/|$)/, /^\/api\/config(\/|$)/];

/** Chaos applies to API requests only; everything else (pages, scripts, images, uploads) is left alone. */
export function chaosApplies(path: string): boolean {
  return /^\/api(\/|$)/.test(path) && !EXCLUDED.some((re) => re.test(path));
}

/** Compiles a path pattern: `*` matches any run of characters, everything else is literal. */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`);
}

/** True when the path matches one of the patterns. An empty list matches every API path. */
export function pathMatches(patterns: readonly string[], path: string): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((p) => patternToRegExp(p).test(path));
}

/** Every Nth request fails, where N = round(1 / failureRate). A rate of 0 never fails. */
export function failureInterval(failureRate: number): number | null {
  if (failureRate <= 0) return null;
  return Math.max(1, Math.round(1 / failureRate));
}

/** Small seeded generator (mulberry32) for the non-deterministic mode. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic jitter cycles through 0, 25, 50, 75 and 100 percent of jitterMs, then repeats. */
export function deterministicJitter(jitterMs: number, index: number): number {
  return Math.round(((index % 5) * jitterMs) / 4);
}

type Errors = Record<string, string>;

function numberIn(value: unknown, field: string, min: number, max: number, integer: boolean, errors: Errors): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    errors[field] = integer ? 'Must be a whole number.' : 'Must be a number.';
    return 0;
  }
  if (value < min || value > max) {
    errors[field] = `Must be between ${min} and ${max}.`;
    return 0;
  }
  return value;
}

/** Validates the body of POST /api/test/chaos. Omitted fields take their neutral value. Throws the standard 400. */
export function parseChaosRequest(body: Record<string, unknown>): ChaosSettings {
  const errors: Errors = {};
  const latencyMs = numberIn(body.latencyMs, 'latencyMs', 0, 5000, true, errors);
  const jitterMs = numberIn(body.jitterMs, 'jitterMs', 0, 1000, true, errors);
  const failureRate = numberIn(body.failureRate, 'failureRate', 0, 1, false, errors);

  let status: ChaosStatus = NEUTRAL_CHAOS.status;
  if (body.status !== undefined) {
    if (CHAOS_STATUSES.includes(body.status as ChaosStatus)) status = body.status as ChaosStatus;
    else errors.status = 'Must be 500, 503 or 429.';
  }

  let deterministic = NEUTRAL_CHAOS.deterministic;
  if (body.deterministic !== undefined) {
    if (typeof body.deterministic === 'boolean') deterministic = body.deterministic;
    else errors.deterministic = 'Must be true or false.';
  }

  let paths: string[] = [];
  if (body.paths !== undefined) {
    if (
      !Array.isArray(body.paths) ||
      body.paths.length > MAX_CHAOS_PATHS ||
      body.paths.some((p) => typeof p !== 'string' || !p.startsWith('/') || p.length > 200)
    ) {
      errors.paths = `Must be a list of at most ${MAX_CHAOS_PATHS} path patterns that start with "/", such as "/api/products*".`;
    } else {
      paths = body.paths as string[];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors: errors });
  }
  return { latencyMs, jitterMs, failureRate, paths, status, deterministic };
}

export interface ChaosDecision {
  delayMs: number;
  fail: boolean;
}

/** Holds the settings and the request counter; every matching request asks it what to do. */
export class ChaosEngine {
  private settings: ChaosSettings = { ...NEUTRAL_CHAOS, paths: [] };
  private counter = 0;
  private rng = createRng(CHAOS_SEED);

  get current(): ChaosSettings {
    return { ...this.settings, paths: [...this.settings.paths] };
  }

  configure(next: ChaosSettings): void {
    this.settings = { ...next, paths: [...next.paths] };
    this.counter = 0;
    this.rng = createRng(CHAOS_SEED);
  }

  reset(): void {
    this.configure(NEUTRAL_CHAOS);
  }

  /** What to do with a request for this path: how long to wait and whether to fail it. Null means leave it alone. */
  decide(path: string): ChaosDecision | null {
    const s = this.settings;
    if (!chaosApplies(path) || !pathMatches(s.paths, path)) return null;
    const index = this.counter++;
    const n = index + 1;
    let jitter: number;
    let fail: boolean;
    if (s.deterministic) {
      jitter = deterministicJitter(s.jitterMs, index);
      const every = failureInterval(s.failureRate);
      fail = every !== null && n % every === 0;
    } else {
      jitter = Math.round(this.rng() * s.jitterMs);
      fail = s.failureRate > 0 && this.rng() < s.failureRate;
    }
    return { delayMs: s.latencyMs + jitter, fail };
  }
}

const ERROR_FOR_STATUS: Record<ChaosStatus, { code: ErrorCode; message: string }> = {
  500: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable. Please try again.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
};

export function chaosError(status: ChaosStatus): ApiError {
  const { code, message } = ERROR_FOR_STATUS[status];
  return new ApiError(code, message, status === 429 ? { headers: { 'Retry-After': '1' } } : {});
}

/** Express middleware: waits, then fails the request when the engine says so. */
export function chaosMiddleware(engine: ChaosEngine): RequestHandler {
  return (req, _res, next) => {
    const decision = engine.decide(req.originalUrl.split('?')[0] ?? req.path);
    if (!decision) {
      next();
      return;
    }
    const status = engine.current.status;
    const finish = () => next(decision.fail ? chaosError(status) : undefined);
    if (decision.delayMs > 0) setTimeout(finish, decision.delayMs);
    else finish();
  };
}
