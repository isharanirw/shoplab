import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { call, startTestServer } from '../testing/harness';
import type { TestServer } from '../testing/harness';
import { FLAG_IDS, setActiveFlags } from './flags';

interface FlagsBody {
  flags: string[];
  available: string[];
}
interface StateBody {
  flags: string[];
  latency: { latencyMs: number; jitterMs: number; failureRate: number; paths: string[]; status: number; deterministic: boolean };
}
interface ErrorBody {
  error: { code: string; message: string; fieldErrors?: Record<string, string> };
}

describe('test endpoints: flags, chaos and state', () => {
  let server: TestServer;
  const post = (url: string, json: unknown) => call(server, 'POST', url, { json });

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });
  afterEach(async () => {
    setActiveFlags([]);
    await post('/api/test/reset', {});
  });

  it('enables, disables and presets flags and reports them in the state', async () => {
    expect((await post('/api/test/flags', { enable: ['f02', 'f01'] })).body).toMatchObject({ flags: ['f01', 'f02'] });
    expect((await call<StateBody>(server, 'GET', '/api/test/state')).body.flags).toEqual(['f01', 'f02']);
    expect((await post('/api/test/flags', { disable: ['f01'] })).body).toMatchObject({ flags: ['f02'] });
    expect((await post('/api/test/flags', { preset: 'all' })).body).toMatchObject({ flags: [...FLAG_IDS] });
    expect((await post('/api/test/flags', { preset: 'none' })).body).toMatchObject({ flags: [] });
    expect((await call<StateBody>(server, 'GET', '/api/test/state')).body.flags).toEqual([]);
  });

  it('lists the available IDs', async () => {
    const res = await call<FlagsBody>(server, 'GET', '/api/test/flags');
    expect(res.status).toBe(200);
    expect(res.body.available).toEqual([...FLAG_IDS]);
  });

  it('rejects unknown IDs and bad bodies with the standard error shape and changes nothing', async () => {
    await post('/api/test/flags', { enable: ['f01'] });
    for (const body of [{ enable: ['f01', 'nope'] }, { disable: ['zz'] }, { preset: 'some' }, {}]) {
      const res = await post('/api/test/flags', body);
      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
      expect((res.body as ErrorBody).error.fieldErrors).toBeDefined();
    }
    expect((await call<FlagsBody>(server, 'GET', '/api/test/flags')).body.flags).toEqual(['f01']);
  });

  it('exposes only the flag IDs on the public config endpoint', async () => {
    await post('/api/test/flags', { enable: ['f03'] });
    const res = await call(server, 'GET', '/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flags: ['f03'] });
  });

  it('keeps flags across a reset', async () => {
    await post('/api/test/flags', { enable: ['f04'] });
    expect((await post('/api/test/reset', {})).status).toBe(204);
    expect((await call<StateBody>(server, 'GET', '/api/test/state')).body.flags).toEqual(['f04']);
  });

  it('stores chaos settings, reports them in the state and clears them on reset', async () => {
    const settings = { latencyMs: 20, jitterMs: 10, failureRate: 0.5, paths: ['/api/products*'], status: 500, deterministic: true };
    const set = await post('/api/test/chaos', settings);
    expect(set.status).toBe(200);
    expect(set.body).toEqual(settings);
    expect((await call<StateBody>(server, 'GET', '/api/test/state')).body.latency).toEqual(settings);
    await post('/api/test/reset', {});
    expect((await call<StateBody>(server, 'GET', '/api/test/state')).body.latency).toEqual({
      latencyMs: 0,
      jitterMs: 0,
      failureRate: 0,
      paths: [],
      status: 503,
      deterministic: true,
    });
  });

  it('rejects chaos settings outside the limits', async () => {
    for (const body of [{ latencyMs: 5001 }, { jitterMs: 1001 }, { failureRate: 1.5 }, { status: 404 }, { paths: 'x' }]) {
      const res = await post('/api/test/chaos', body);
      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.fieldErrors).toBeDefined();
    }
  });

  it('fails every Nth matching request with the chosen status and leaves other paths alone', async () => {
    await post('/api/test/chaos', { failureRate: 0.5, paths: ['/api/products*'], status: 503 });
    const products = [];
    for (let i = 0; i < 4; i += 1) products.push((await call(server, 'GET', '/api/products?pageSize=1')).status);
    expect(products).toEqual([200, 503, 200, 503]);
    expect((await call(server, 'GET', '/api/categories')).status).toBe(200);
    const failed = await call<ErrorBody>(server, 'GET', '/api/products');
    const ok = await call(server, 'GET', '/api/products');
    expect([failed.status, ok.status].sort()).toEqual([200, 503]);
  });

  it('answers a failed request with the standard error shape, and with Retry-After for 429', async () => {
    await post('/api/test/chaos', { failureRate: 1, status: 429 });
    const limited = await call<ErrorBody>(server, 'GET', '/api/categories');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    await post('/api/test/chaos', { failureRate: 1, status: 500 });
    const failed = await call<ErrorBody>(server, 'GET', '/api/categories');
    expect(failed.status).toBe(500);
    expect(failed.headers.get('retry-after')).toBeNull();
  });

  it('never applies chaos to test endpoints, health, config or static files', async () => {
    await post('/api/test/chaos', { failureRate: 1, status: 500 });
    expect((await call(server, 'GET', '/api/health')).status).toBe(200);
    expect((await call(server, 'GET', '/api/test/state')).status).toBe(200);
    expect((await call(server, 'GET', '/api/config')).status).toBe(200);
    expect((await call(server, 'GET', '/ads/promo-banner.js')).status).toBe(200);
    expect((await call(server, 'GET', '/analytics/track.js')).status).toBe(200);
    expect((await call(server, 'GET', '/api/categories')).status).toBe(500);
  });

  it('delays matching requests by the configured latency', async () => {
    await post('/api/test/chaos', { latencyMs: 150 });
    const start = Date.now();
    expect((await call(server, 'GET', '/api/categories')).status).toBe(200);
    expect(Date.now() - start).toBeGreaterThanOrEqual(140);
    const quick = Date.now();
    await call(server, 'GET', '/api/health');
    expect(Date.now() - quick).toBeLessThan(140);
  });

  it('serves the two scripts', async () => {
    for (const url of ['/ads/promo-banner.js', '/analytics/track.js']) {
      const res = await call(server, 'GET', url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('javascript');
    }
    expect((await call(server, 'POST', '/analytics/collect')).status).toBe(204);
    expect((await call(server, 'GET', '/ads/missing.js')).status).toBe(404);
  });
});

describe('test endpoints with a key', () => {
  let keyed: TestServer;

  beforeAll(async () => {
    keyed = await startTestServer('default', { testApiKey: 'secret-key' });
  });
  afterAll(async () => {
    await keyed.close();
  });

  it('asks for X-Test-Key on the flags and chaos endpoints too', async () => {
    for (const [method, url] of [
      ['GET', '/api/test/flags'],
      ['POST', '/api/test/flags'],
      ['POST', '/api/test/chaos'],
      ['GET', '/api/test/state'],
    ] as const) {
      const res = await call(keyed, method, url, { json: method === 'POST' ? { preset: 'none' } : undefined });
      expect(res.status, `${method} ${url}`).toBe(401);
    }
    const headers = { 'X-Test-Key': 'secret-key', 'Content-Type': 'application/json' };
    const ok = await fetch(`${keyed.baseUrl}/api/test/flags`, { method: 'POST', headers, body: JSON.stringify({ preset: 'none' }) });
    expect(ok.status).toBe(200);
  });

  it('leaves the public config endpoint open', async () => {
    expect((await call(keyed, 'GET', '/api/config')).status).toBe(200);
  });
});
