import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/errors';
import {
  CHAOS_SEED,
  ChaosEngine,
  NEUTRAL_CHAOS,
  chaosApplies,
  chaosError,
  createRng,
  deterministicJitter,
  failureInterval,
  parseChaosRequest,
  pathMatches,
} from './chaos';
import type { ChaosSettings } from './chaos';

const settings = (patch: Partial<ChaosSettings>): ChaosSettings => ({ ...NEUTRAL_CHAOS, ...patch });

function expectFieldError(body: Record<string, unknown>, field: string) {
  try {
    parseChaosRequest(body);
    expect.unreachable();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).fieldErrors).toHaveProperty(field);
  }
}

describe('chaos request validation', () => {
  it('accepts the documented example', () => {
    const parsed = parseChaosRequest({ latencyMs: 800, jitterMs: 200, failureRate: 0.2, paths: ['/api/products*'], status: 503, deterministic: true });
    expect(parsed).toEqual({ latencyMs: 800, jitterMs: 200, failureRate: 0.2, paths: ['/api/products*'], status: 503, deterministic: true });
  });

  it('gives omitted fields their neutral value', () => {
    expect(parseChaosRequest({})).toEqual(NEUTRAL_CHAOS);
  });

  it('accepts the limits themselves', () => {
    expect(parseChaosRequest({ latencyMs: 5000, jitterMs: 1000, failureRate: 1 })).toMatchObject({ latencyMs: 5000, jitterMs: 1000, failureRate: 1 });
    expect(parseChaosRequest({ latencyMs: 0, jitterMs: 0, failureRate: 0 })).toMatchObject({ latencyMs: 0, jitterMs: 0, failureRate: 0 });
  });

  it('rejects values outside the limits', () => {
    expectFieldError({ latencyMs: 5001 }, 'latencyMs');
    expectFieldError({ latencyMs: -1 }, 'latencyMs');
    expectFieldError({ jitterMs: 1001 }, 'jitterMs');
    expectFieldError({ failureRate: 1.01 }, 'failureRate');
    expectFieldError({ failureRate: -0.1 }, 'failureRate');
  });

  it('rejects the wrong types and fractional milliseconds', () => {
    expectFieldError({ latencyMs: '800' }, 'latencyMs');
    expectFieldError({ latencyMs: 10.5 }, 'latencyMs');
    expectFieldError({ failureRate: 'half' }, 'failureRate');
    expectFieldError({ deterministic: 'yes' }, 'deterministic');
  });

  it('allows only the statuses 500, 503 and 429', () => {
    for (const status of [500, 503, 429]) expect(parseChaosRequest({ status }).status).toBe(status);
    expectFieldError({ status: 404 }, 'status');
    expectFieldError({ status: '503' }, 'status');
  });

  it('validates the path list', () => {
    expectFieldError({ paths: '/api/products*' }, 'paths');
    expectFieldError({ paths: ['api/products'] }, 'paths');
    expectFieldError({ paths: [1] }, 'paths');
    expectFieldError({ paths: Array.from({ length: 21 }, () => '/api/x') }, 'paths');
  });

  it('reports every problem together', () => {
    try {
      parseChaosRequest({ latencyMs: 9999, failureRate: 2, status: 1 });
      expect.unreachable();
    } catch (err) {
      expect(Object.keys((err as ApiError).fieldErrors ?? {}).sort()).toEqual(['failureRate', 'latencyMs', 'status']);
    }
  });
});

describe('path matching', () => {
  it('matches a trailing wildcard', () => {
    expect(pathMatches(['/api/products*'], '/api/products')).toBe(true);
    expect(pathMatches(['/api/products*'], '/api/products/12')).toBe(true);
    expect(pathMatches(['/api/products*'], '/api/cart')).toBe(false);
  });

  it('matches exact paths and wildcards in the middle', () => {
    expect(pathMatches(['/api/cart'], '/api/cart')).toBe(true);
    expect(pathMatches(['/api/cart'], '/api/cart/items')).toBe(false);
    expect(pathMatches(['/api/*/reviews'], '/api/products/reviews')).toBe(true);
    expect(pathMatches(['/api/*/reviews'], '/api/products/5/reviews')).toBe(true);
  });

  it('treats other characters literally', () => {
    expect(pathMatches(['/api/a.b'], '/api/axb')).toBe(false);
    expect(pathMatches(['/api/a.b'], '/api/a.b')).toBe(true);
    expect(pathMatches(['/api/(x)'], '/api/(x)')).toBe(true);
  });

  it('matches any of several patterns, and everything when the list is empty', () => {
    expect(pathMatches(['/api/cart*', '/api/orders*'], '/api/orders/3')).toBe(true);
    expect(pathMatches([], '/api/anything')).toBe(true);
  });
});

describe('what chaos never touches', () => {
  it('leaves test endpoints, health, docs, config and non-API paths alone', () => {
    const paths = [
      '/api/test/reset',
      '/api/test/chaos',
      '/api/health',
      '/api/docs',
      '/api/docs/openapi.yaml',
      '/api/config',
      '/',
      '/products',
      '/assets/app.js',
      '/ads/promo-banner.js',
      '/analytics/track.js',
      '/uploads/x.png',
    ];
    for (const path of paths) expect(chaosApplies(path), path).toBe(false);
  });

  it('applies to other API paths', () => {
    for (const path of ['/api/products', '/api/cart', '/api/auth/login', '/api/admin/users']) expect(chaosApplies(path), path).toBe(true);
  });

  it('does not count excluded paths even with a catch-all pattern', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ failureRate: 1, paths: ['/*'] }));
    expect(engine.decide('/api/health')).toBeNull();
    expect(engine.decide('/api/test/state')).toBeNull();
    expect(engine.decide('/styles.css')).toBeNull();
    expect(engine.decide('/api/products')?.fail).toBe(true);
  });
});

describe('failure interval', () => {
  it('is round(1 / rate)', () => {
    expect(failureInterval(0.2)).toBe(5);
    expect(failureInterval(0.5)).toBe(2);
    expect(failureInterval(0.3)).toBe(3);
    expect(failureInterval(1)).toBe(1);
    expect(failureInterval(0.9)).toBe(1);
  });

  it('is never for a rate of zero', () => {
    expect(failureInterval(0)).toBeNull();
  });
});

describe('deterministic mode', () => {
  it('fails every Nth matching request', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ failureRate: 0.25, paths: ['/api/products*'] }));
    const outcomes = Array.from({ length: 12 }, () => engine.decide('/api/products')?.fail);
    expect(outcomes).toEqual([false, false, false, true, false, false, false, true, false, false, false, true]);
  });

  it('counts only matching requests', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ failureRate: 0.5, paths: ['/api/products*'] }));
    expect(engine.decide('/api/cart')).toBeNull();
    expect(engine.decide('/api/products')?.fail).toBe(false);
    expect(engine.decide('/api/cart')).toBeNull();
    expect(engine.decide('/api/products')?.fail).toBe(true);
  });

  it('fails every request at a rate of 1 and none at a rate of 0', () => {
    const always = new ChaosEngine();
    always.configure(settings({ failureRate: 1 }));
    expect([1, 2, 3].map(() => always.decide('/api/x')?.fail)).toEqual([true, true, true]);
    const never = new ChaosEngine();
    never.configure(settings({ failureRate: 0 }));
    expect([1, 2, 3].map(() => never.decide('/api/x')?.fail)).toEqual([false, false, false]);
  });

  it('adds latency and a repeating jitter pattern', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ latencyMs: 100, jitterMs: 40 }));
    const delays = Array.from({ length: 7 }, () => engine.decide('/api/x')?.delayMs);
    expect(delays).toEqual([100, 110, 120, 130, 140, 100, 110]);
  });

  it('restarts the count when reconfigured', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ failureRate: 0.5 }));
    engine.decide('/api/x');
    engine.configure(settings({ failureRate: 0.5 }));
    expect(engine.decide('/api/x')?.fail).toBe(false);
    expect(engine.decide('/api/x')?.fail).toBe(true);
  });
});

describe('non-deterministic mode', () => {
  it('repeats the same sequence from the same seed', () => {
    const run = () => {
      const engine = new ChaosEngine();
      engine.configure(settings({ failureRate: 0.5, jitterMs: 100, deterministic: false }));
      return Array.from({ length: 20 }, () => engine.decide('/api/x'));
    };
    expect(run()).toEqual(run());
  });

  it('fails roughly in proportion to the rate and keeps jitter inside its limit', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ failureRate: 0.3, jitterMs: 50, latencyMs: 10, deterministic: false }));
    const decisions = Array.from({ length: 2000 }, () => engine.decide('/api/x')!);
    const failures = decisions.filter((d) => d.fail).length;
    expect(failures).toBeGreaterThan(450);
    expect(failures).toBeLessThan(750);
    expect(decisions.every((d) => d.delayMs >= 10 && d.delayMs <= 60)).toBe(true);
  });

  it('never fails at a rate of 0', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ failureRate: 0, deterministic: false }));
    expect(Array.from({ length: 200 }, () => engine.decide('/api/x')?.fail).every((f) => f === false)).toBe(true);
  });

  it('has a generator that stays between 0 and 1', () => {
    const rng = createRng(CHAOS_SEED);
    for (let i = 0; i < 1000; i += 1) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('jitter pattern', () => {
  it('cycles through 0, 25, 50, 75 and 100 percent', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => deterministicJitter(200, i))).toEqual([0, 50, 100, 150, 200, 0]);
  });
});

describe('reset', () => {
  it('returns to neutral settings', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ latencyMs: 500, failureRate: 1, paths: ['/api/x'], status: 429 }));
    engine.reset();
    expect(engine.current).toEqual(NEUTRAL_CHAOS);
    expect(engine.decide('/api/x')).toEqual({ delayMs: 0, fail: false });
  });

  it('does not let callers change the stored settings', () => {
    const engine = new ChaosEngine();
    engine.configure(settings({ paths: ['/api/x'] }));
    engine.current.paths.push('/api/y');
    expect(engine.current.paths).toEqual(['/api/x']);
  });
});

describe('failure responses', () => {
  it('uses the requested status', () => {
    expect(chaosError(500).status).toBe(500);
    expect(chaosError(503).status).toBe(503);
    expect(chaosError(429).status).toBe(429);
  });

  it('sends Retry-After with a 429 only', () => {
    expect(chaosError(429).headers).toEqual({ 'Retry-After': '1' });
    expect(chaosError(503).headers).toBeUndefined();
  });
});
