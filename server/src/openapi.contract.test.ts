import fs from 'node:fs';
import path from 'node:path';
import { Validator } from '@seriousme/openapi-schema-validator';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { loadConfig } from './config';
import { call, loginAs, startTestServer, TINY_PNG } from './testing/harness';
import type { CallResult, TestServer } from './testing/harness';

/**
 * The API contract test: the OpenAPI document must be a valid OpenAPI 3.1 file, and real responses from the running app
 * must match the schemas it documents (success and error cases for every endpoint group). The test only talks to the
 * app's own API over HTTP; it is not a browser test.
 */

const specPath = loadConfig().openApiPath;
const specText = fs.readFileSync(specPath, 'utf8');
const spec = parse(specText) as OpenApiDocument;

interface OpenApiDocument {
  paths: Record<string, Record<string, Operation>>;
  components: Record<string, Record<string, unknown>>;
}
interface Operation {
  operationId?: string;
  responses: Record<string, { $ref?: string; content?: Record<string, { schema?: unknown }> }>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function resolveRef(ref: string): unknown {
  let node: unknown = spec;
  for (const part of ref.replace(/^#\//, '').split('/')) node = (node as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  return node;
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const compiled = new Map<string, ReturnType<typeof ajv.compile>>();

/** The compiled schema for a documented response, with `components` attached so `$ref`s resolve. */
function responseValidator(template: string, method: string, status: number) {
  const op = spec.paths[template]?.[method];
  if (!op) throw new Error(`${method.toUpperCase()} ${template} is not in the OpenAPI document`);
  const entry = op.responses[String(status)] ?? op.responses.default;
  if (!entry) {
    throw new Error(`${method.toUpperCase()} ${template} answered ${status}, which the OpenAPI document does not list (it lists ${Object.keys(op.responses).join(', ')})`);
  }
  const response = (entry.$ref ? resolveRef(entry.$ref) : entry) as { content?: Record<string, { schema?: unknown }> };
  const schema = response.content?.['application/json']?.schema;
  if (!schema) return null; // documented without a JSON body (for example 204)
  const key = `${method} ${template} ${status}`;
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile({ ...(schema as object), components: spec.components });
    compiled.set(key, validate);
  }
  return validate;
}

/** Fails with a readable message unless the response status is documented and the body matches the documented schema. */
function expectContract(res: CallResult, method: string, template: string, expectedStatus: number) {
  expect(res.status, `${method.toUpperCase()} ${template}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(expectedStatus);
  const validate = responseValidator(template, method, res.status);
  if (!validate) {
    expect(res.body, `${method.toUpperCase()} ${template} documents no body`).toBeNull();
    return;
  }
  const ok = validate(res.body);
  expect(ok, `${method.toUpperCase()} ${template} ${res.status} does not match its schema:\n${JSON.stringify(validate.errors, null, 2)}\nbody: ${JSON.stringify(res.body).slice(0, 600)}`).toBe(true);
}

describe('the OpenAPI document', () => {
  it('is valid OpenAPI 3.1', async () => {
    const result = await new Validator().validate(spec as never);
    expect(result.valid, JSON.stringify(result.valid ? [] : result.errors, null, 2)).toBe(true);
  });

  it('has no reference that points nowhere', () => {
    const refs: string[] = [];
    JSON.stringify(spec, (key, value: unknown) => {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      return value;
    });
    expect(refs.length).toBeGreaterThan(50);
    for (const ref of refs) expect(resolveRef(ref), `unresolved ${ref}`).toBeDefined();
  });

  it('gives every operation a unique operationId and at least one documented response', () => {
    const ids: string[] = [];
    for (const [template, item] of Object.entries(spec.paths)) {
      for (const method of Object.keys(item).filter((m) => METHODS.includes(m))) {
        const op = item[method]!;
        expect(op.operationId, `${method} ${template}`).toBeTruthy();
        expect(Object.keys(op.responses).length, `${method} ${template}`).toBeGreaterThan(0);
        ids.push(op.operationId!);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('documents the security schemes the API uses', () => {
    expect(Object.keys(spec.components.securitySchemes!).sort()).toEqual(['bearerAuth', 'cookieAuth', 'testKey']);
  });
});

describe('real responses match the document', () => {
  let server: TestServer;
  let customer: string;
  let customer2: string;
  let admin: string;
  const get = (url: string, token?: string) => call(server, 'GET', url, { token });
  const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  beforeAll(async () => {
    server = await startTestServer();
    customer = await loginAs(server, 'customer1@shoplab.test');
    customer2 = await loginAs(server, 'customer2@shoplab.test');
    admin = await loginAs(server, 'admin@shoplab.test');
  });

  afterAll(async () => {
    await server.close();
  });

  it('public catalogue endpoints: success and errors', async () => {
    expectContract(await get('/api/health'), 'get', '/api/health', 200);
    expectContract(await get('/api/products?pageSize=5&sort=rating'), 'get', '/api/products', 200);
    expectContract(await get('/api/products?page=99'), 'get', '/api/products', 200);
    expectContract(await get('/api/products?minPrice=abc&sort=nope'), 'get', '/api/products', 400);
    expectContract(await get('/api/products/suggest?q=lamp'), 'get', '/api/products/suggest', 200);
    expectContract(await get(`/api/products/suggest?q=${'a'.repeat(101)}`), 'get', '/api/products/suggest', 400);
    expectContract(await get('/api/products/1'), 'get', '/api/products/{id}', 200);
    expectContract(await get('/api/products/9'), 'get', '/api/products/{id}', 200); // a product with variants
    expectContract(await get('/api/products/999'), 'get', '/api/products/{id}', 404);
    expectContract(await get('/api/products/abc'), 'get', '/api/products/{id}', 400);
    expectContract(await get('/api/products/1/reviews'), 'get', '/api/products/{id}/reviews', 200);
    expectContract(await get('/api/products/999/reviews'), 'get', '/api/products/{id}/reviews', 404);
    expectContract(await get('/api/products/1/review-eligibility'), 'get', '/api/products/{id}/review-eligibility', 200);
    expectContract(await get('/api/products/1/review-eligibility', customer), 'get', '/api/products/{id}/review-eligibility', 200);
    expectContract(await get('/api/products/999/review-eligibility'), 'get', '/api/products/{id}/review-eligibility', 404);
    expectContract(await get('/api/categories'), 'get', '/api/categories', 200);
    expectContract(await get('/api/promotions'), 'get', '/api/promotions', 200);
    expectContract(await get('/api/countries'), 'get', '/api/countries', 200);
  });

  it('geo and contact', async () => {
    expectContract(await get('/api/geo'), 'get', '/api/geo', 200);
    expectContract(await get('/api/geo?country=us'), 'get', '/api/geo', 200);
    expectContract(await get('/api/geo?country=FR'), 'get', '/api/geo', 400);
    const ok = { topic: 'order', message: 'Where is my order, please?', consent: true };
    expectContract(await call(server, 'POST', '/api/contact', { json: ok }), 'post', '/api/contact', 201);
    expectContract(await call(server, 'POST', '/api/contact', { json: { topic: 'x' } }), 'post', '/api/contact', 400);
  });

  it('auth endpoints', async () => {
    const register = { name: 'Newcomer', email: 'newcomer@shoplab.test', password: 'Newcomer@123', confirmPassword: 'Newcomer@123', acceptTerms: true };
    const created = await call<{ token: string }>(server, 'POST', '/api/auth/register', { json: register });
    expectContract(created, 'post', '/api/auth/register', 201);
    expectContract(await call(server, 'POST', '/api/auth/register', { json: register }), 'post', '/api/auth/register', 409);
    expectContract(await call(server, 'POST', '/api/auth/register', { json: {} }), 'post', '/api/auth/register', 400);

    const login = (email: string, password: string) => call(server, 'POST', '/api/auth/login', { json: { email, password } });
    const loggedIn = await login('customer2@shoplab.test', 'Test@1234');
    expectContract(loggedIn, 'post', '/api/auth/login', 200);
    expectContract(await login('customer2@shoplab.test', 'wrong'), 'post', '/api/auth/login', 401);
    expectContract(await login('locked@shoplab.test', 'Test@1234'), 'post', '/api/auth/login', 423);
    expectContract(await call(server, 'POST', '/api/auth/login', { json: {} }), 'post', '/api/auth/login', 400);
    let limited: CallResult | null = null;
    for (let i = 0; i < 6; i++) limited = await login('ghost@shoplab.test', 'wrong');
    expectContract(limited!, 'post', '/api/auth/login', 429);
    expect(limited!.headers.get('retry-after')).toBeTruthy();

    expectContract(await get('/api/auth/me', customer), 'get', '/api/auth/me', 200);
    expectContract(await get('/api/auth/me'), 'get', '/api/auth/me', 401);
    expectContract(await call(server, 'PATCH', '/api/auth/me', { token: customer, json: { name: 'Customer One' } }), 'patch', '/api/auth/me', 200);
    expectContract(await call(server, 'PATCH', '/api/auth/me', { token: customer, json: { name: 'x' } }), 'patch', '/api/auth/me', 400);
    expectContract(await call(server, 'PATCH', '/api/auth/me', { json: { name: 'Customer One' } }), 'patch', '/api/auth/me', 401);

    expectContract(await call(server, 'POST', '/api/auth/logout', { token: created.body.token }), 'post', '/api/auth/logout', 204);
    expectContract(await call(server, 'POST', '/api/auth/logout'), 'post', '/api/auth/logout', 401);
  });

  it('wishlist endpoints', async () => {
    expectContract(await get('/api/wishlist', customer2), 'get', '/api/wishlist', 200);
    expectContract(await get('/api/wishlist'), 'get', '/api/wishlist', 401);
    expectContract(await call(server, 'POST', '/api/wishlist', { token: customer2, json: { productId: 5 } }), 'post', '/api/wishlist', 201);
    expectContract(await call(server, 'POST', '/api/wishlist', { token: customer2, json: { productId: 5 } }), 'post', '/api/wishlist', 200);
    expectContract(await call(server, 'POST', '/api/wishlist', { token: customer2, json: { productId: 9 } }), 'post', '/api/wishlist', 201);
    expectContract(await call(server, 'POST', '/api/wishlist', { token: customer2, json: { productId: 999 } }), 'post', '/api/wishlist', 404);
    expectContract(await call(server, 'POST', '/api/wishlist', { token: customer2, json: { productId: 'x' } }), 'post', '/api/wishlist', 400);
    expectContract(await call(server, 'PUT', '/api/wishlist/order', { token: customer2, json: { productIds: [9, 5] } }), 'put', '/api/wishlist/order', 200);
    expectContract(await call(server, 'PUT', '/api/wishlist/order', { token: customer2, json: { productIds: [9] } }), 'put', '/api/wishlist/order', 400);
    expectContract(await call(server, 'DELETE', '/api/wishlist/5', { token: customer2 }), 'delete', '/api/wishlist/{productId}', 204);
    expectContract(await call(server, 'DELETE', '/api/wishlist/5', { token: customer2 }), 'delete', '/api/wishlist/{productId}', 404);
    expectContract(await call(server, 'DELETE', '/api/wishlist/9'), 'delete', '/api/wishlist/{productId}', 401);
    await call(server, 'DELETE', '/api/wishlist/9', { token: customer2 });
  });

  it('cart, quote and coupon endpoints', async () => {
    expectContract(await get('/api/cart'), 'get', '/api/cart', 401);
    expectContract(await get('/api/cart', customer2), 'get', '/api/cart', 200);
    const added = await call<{ items: { id: number }[] }>(server, 'POST', '/api/cart/items', { token: customer2, json: { productId: 15, quantity: 2 } });
    expectContract(added, 'post', '/api/cart/items', 201);
    expectContract(await call(server, 'POST', '/api/cart/items', { token: customer2, json: { productId: 15, quantity: 1 } }), 'post', '/api/cart/items', 200);
    expectContract(await call(server, 'POST', '/api/cart/items', { token: customer2, json: { productId: 999, quantity: 1 } }), 'post', '/api/cart/items', 404);
    expectContract(await call(server, 'POST', '/api/cart/items', { token: customer2, json: { productId: 7, quantity: 1 } }), 'post', '/api/cart/items', 409);
    expectContract(await call(server, 'POST', '/api/cart/items', { token: customer2, json: { productId: 15, quantity: 0 } }), 'post', '/api/cart/items', 400);
    const itemId = added.body.items[0]!.id;
    expectContract(await call(server, 'PATCH', `/api/cart/items/${itemId}`, { token: customer2, json: { quantity: 2 } }), 'patch', '/api/cart/items/{itemId}', 200);
    expectContract(await call(server, 'PATCH', `/api/cart/items/${itemId}`, { token: customer2, json: { quantity: 11 } }), 'patch', '/api/cart/items/{itemId}', 400);
    expectContract(await call(server, 'PATCH', '/api/cart/items/9999', { token: customer2, json: { quantity: 2 } }), 'patch', '/api/cart/items/{itemId}', 404);
    expectContract(await call(server, 'POST', '/api/cart/coupon', { token: customer2, json: { code: 'SAVE10' } }), 'post', '/api/cart/coupon', 200);
    expectContract(await call(server, 'POST', '/api/cart/coupon', { token: customer2, json: { code: 'MIN100' } }), 'post', '/api/cart/coupon', 409);
    expectContract(
      await call(server, 'POST', '/api/checkout/quote', { token: customer2, json: { shippingMethod: 'express', country: 'SE' } }),
      'post',
      '/api/checkout/quote',
      200,
    );
    expectContract(await call(server, 'POST', '/api/checkout/quote', { token: customer2, json: { shippingMethod: 'air', country: 'XX' } }), 'post', '/api/checkout/quote', 400);
    expectContract(await call(server, 'POST', '/api/checkout/quote', { json: {} }), 'post', '/api/checkout/quote', 401);
    expectContract(await call(server, 'DELETE', '/api/cart/coupon', { token: customer2 }), 'delete', '/api/cart/coupon', 200);
    expectContract(await call(server, 'POST', '/api/cart/coupon', { token: customer2, json: { code: 'NOPE' } }), 'post', '/api/cart/coupon', 400);
    expectContract(
      await call(server, 'POST', '/api/cart/merge', { token: customer2, json: { items: [{ productId: 15, quantity: 9 }, { productId: 999, quantity: 1 }] } }),
      'post',
      '/api/cart/merge',
      200,
    );
    expectContract(await call(server, 'POST', '/api/cart/merge', { token: customer2, json: { items: 'x' } }), 'post', '/api/cart/merge', 400);
    expectContract(await call(server, 'DELETE', `/api/cart/items/${itemId}`, { token: customer2 }), 'delete', '/api/cart/items/{itemId}', 200);
    expectContract(await call(server, 'DELETE', `/api/cart/items/${itemId}`, { token: customer2 }), 'delete', '/api/cart/items/{itemId}', 404);
    expectContract(await call(server, 'DELETE', '/api/cart', { token: customer2 }), 'delete', '/api/cart', 200);
  });

  it('address book endpoints', async () => {
    const address = {
      firstName: 'Nina',
      lastName: 'Nilsson',
      street: '12 Test Street',
      countryCode: 'SE',
      regionCode: (server.db.prepare("SELECT code FROM regions WHERE country_code = 'SE' LIMIT 1").get() as { code: string }).code,
      postalCode: '11122',
      phone: '+46 70 123 4567',
    };
    expectContract(await get('/api/addresses'), 'get', '/api/addresses', 401);
    expectContract(await get('/api/addresses', customer2), 'get', '/api/addresses', 200);
    const created = await call<{ id: number }>(server, 'POST', '/api/addresses', { token: customer2, json: address });
    expectContract(created, 'post', '/api/addresses', 201);
    expectContract(await call(server, 'POST', '/api/addresses', { token: customer2, json: { ...address, postalCode: 'x' } }), 'post', '/api/addresses', 400);
    const id = created.body.id;
    expectContract(await get(`/api/addresses/${id}`, customer2), 'get', '/api/addresses/{id}', 200);
    expectContract(await get('/api/addresses/9999', customer2), 'get', '/api/addresses/{id}', 404);
    expectContract(await call(server, 'PATCH', `/api/addresses/${id}`, { token: customer2, json: { label: 'Home' } }), 'patch', '/api/addresses/{id}', 200);
    expectContract(await call(server, 'PATCH', `/api/addresses/${id}`, { token: customer2, json: {} }), 'patch', '/api/addresses/{id}', 400);
    expectContract(await call(server, 'DELETE', `/api/addresses/${id}`, { token: customer2 }), 'delete', '/api/addresses/{id}', 204);
    expectContract(await call(server, 'DELETE', `/api/addresses/${id}`, { token: customer2 }), 'delete', '/api/addresses/{id}', 404);
  });

  it('orders: place, list, read, cancel and the error cases', async () => {
    const order = (paymentToken: string, extra: Record<string, unknown> = {}) => ({
      shippingMethod: 'express',
      deliveryDate: tomorrow(),
      address: {
        firstName: 'Nina',
        lastName: 'Nilsson',
        street: '12 Test Street',
        countryCode: 'SE',
        regionCode: (server.db.prepare("SELECT code FROM regions WHERE country_code = 'SE' LIMIT 1").get() as { code: string }).code,
        postalCode: '11122',
        phone: '+46 70 123 4567',
      },
      paymentToken,
      acceptTerms: true,
      ...extra,
    });
    const fillCart = () => call(server, 'POST', '/api/cart/items', { token: customer2, json: { productId: 15, quantity: 1 } });

    expectContract(await call(server, 'POST', '/api/orders', { json: {} }), 'post', '/api/orders', 401);
    await fillCart();
    expectContract(await call(server, 'POST', '/api/orders', { token: customer2, json: {} }), 'post', '/api/orders', 400);
    expectContract(await call(server, 'POST', '/api/orders', { token: customer2, json: order('tok_declined_0002') }), 'post', '/api/orders', 402);
    server.db.prepare('UPDATE products SET stock = 0 WHERE id = 15').run();
    expectContract(await call(server, 'POST', '/api/orders', { token: customer2, json: order('tok_ok_4242') }), 'post', '/api/orders', 409);
    server.db.prepare('UPDATE products SET stock = 20 WHERE id = 15').run();
    const placed = await call<{ id: number }>(server, 'POST', '/api/orders', { token: customer2, json: order('tok_ok_4242') });
    expectContract(placed, 'post', '/api/orders', 201);

    expectContract(await get('/api/orders'), 'get', '/api/orders', 401);
    expectContract(await get('/api/orders?status=Processing', customer2), 'get', '/api/orders', 200);
    expectContract(await get('/api/orders?page=9', customer2), 'get', '/api/orders', 200);
    expectContract(await get('/api/orders?status=Lost', customer2), 'get', '/api/orders', 400);
    expectContract(await get(`/api/orders/${placed.body.id}`, customer2), 'get', '/api/orders/{id}', 200);
    expectContract(await get('/api/orders/1', customer2), 'get', '/api/orders/{id}', 404); // someone else's order
    expectContract(await get('/api/orders/abc', customer2), 'get', '/api/orders/{id}', 400);
    expectContract(await call(server, 'POST', `/api/orders/${placed.body.id}/cancel`, { token: customer2 }), 'post', '/api/orders/{id}/cancel', 200);
    expectContract(await call(server, 'POST', `/api/orders/${placed.body.id}/cancel`, { token: customer2 }), 'post', '/api/orders/{id}/cancel', 409);
    expectContract(await call(server, 'POST', '/api/orders/1/cancel', { token: customer2 }), 'post', '/api/orders/{id}/cancel', 404);
    expectContract(await call(server, 'POST', `/api/orders/${placed.body.id}/cancel`), 'post', '/api/orders/{id}/cancel', 401);
    expectContract(await get('/api/orders', customer), 'get', '/api/orders', 200); // customer1's seeded orders
  });

  it('review posting, with a multipart image', async () => {
    const form = (extra: Record<string, string> = {}, image: Buffer | null = TINY_PNG) => {
      const f = new FormData();
      f.set('rating', extra.rating ?? '5');
      f.set('title', extra.title ?? 'Works well');
      f.set('body', extra.body ?? 'This product has worked well for me every day.');
      if (image) f.set('image', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'photo.png');
      return f;
    };
    const post = (token: string | undefined, f: FormData, product = 3) => call(server, 'POST', `/api/products/${product}/reviews`, { token, form: f });

    expectContract(await post(undefined, form()), 'post', '/api/products/{id}/reviews', 401);
    expectContract(await post(customer2, form()), 'post', '/api/products/{id}/reviews', 403);
    expectContract(await post(customer, form({ title: 'x' })), 'post', '/api/products/{id}/reviews', 400);
    expectContract(await post(customer, form(), 999), 'post', '/api/products/{id}/reviews', 404);
    const big = Buffer.concat([TINY_PNG, Buffer.alloc(2 * 1024 * 1024)]);
    expectContract(await post(customer, form({}, big)), 'post', '/api/products/{id}/reviews', 413);
    const created = await post(customer, form());
    expectContract(created, 'post', '/api/products/{id}/reviews', 201);
    expect((created.body as { imagePath: string }).imagePath).toMatch(/^\/uploads\/reviews\//);
    expectContract(await post(customer, form()), 'post', '/api/products/{id}/reviews', 409);
    expectContract(await get('/api/products/3/reviews'), 'get', '/api/products/{id}/reviews', 200);
  });

  it('admin endpoints: anonymous 401, customer 403, admin success and errors', async () => {
    const send = (method: string, url: string, token?: string, json?: unknown) => call(server, method, url, { token, json });
    const adminRoutes: [string, string, unknown?][] = [
      ['GET', '/api/admin/products'],
      ['POST', '/api/admin/products', { name: 'x' }],
      ['GET', '/api/admin/products/1'],
      ['PATCH', '/api/admin/products/1', { name: 'xx' }],
      ['DELETE', '/api/admin/products/1'],
      ['GET', '/api/admin/orders'],
      ['PATCH', '/api/admin/orders/3/status', { status: 'Shipped' }],
      ['GET', '/api/admin/users'],
      ['PATCH', '/api/admin/users/2/lock', { locked: true }],
    ];
    for (const [method, url, body] of adminRoutes) {
      const template = url.replace(/\/\d+/g, '/{id}');
      expectContract(await send(method, url, undefined, body), method.toLowerCase(), template, 401);
      expectContract(await send(method, url, customer, body), method.toLowerCase(), template, 403);
    }

    expectContract(await get('/api/admin/products?pageSize=5&q=lamp', admin), 'get', '/api/admin/products', 200);
    expectContract(await get('/api/admin/products?page=99', admin), 'get', '/api/admin/products', 200);
    expectContract(await get('/api/admin/products?active=maybe', admin), 'get', '/api/admin/products', 400);
    const created = await send('POST', '/api/admin/products', admin, { name: 'Contract Lamp', category: 'Home', priceCents: 2500, salePriceCents: 2000, stock: 4 });
    expectContract(created, 'post', '/api/admin/products', 201);
    expect((created.body as { id: number }).id).toBe(61);
    expectContract(await send('POST', '/api/admin/products', admin, { name: '', category: 'Cars', priceCents: 0, stock: -1 }), 'post', '/api/admin/products', 400);

    const form = new FormData();
    form.set('name', 'Contract Mug');
    form.set('category', 'Home');
    form.set('priceCents', '1200');
    form.set('stock', '3');
    form.set('active', 'true');
    form.set('image', new Blob([new Uint8Array(TINY_PNG)], { type: 'image/png' }), 'mug.png');
    const withImage = await call<{ id: number; imagePath: string }>(server, 'POST', '/api/admin/products', { token: admin, form });
    expectContract(withImage, 'post', '/api/admin/products', 201);
    expect(withImage.body.imagePath).toMatch(/^\/uploads\/products\//);
    const big = new FormData();
    big.set('name', 'Too Big');
    big.set('category', 'Home');
    big.set('priceCents', '1200');
    big.set('stock', '3');
    big.set('image', new Blob([new Uint8Array(Buffer.concat([TINY_PNG, Buffer.alloc(2 * 1024 * 1024)]))], { type: 'image/png' }), 'big.png');
    expectContract(await call(server, 'POST', '/api/admin/products', { token: admin, form: big }), 'post', '/api/admin/products', 413);

    expectContract(await get('/api/admin/products/61', admin), 'get', '/api/admin/products/{id}', 200);
    expectContract(await get('/api/admin/products/999', admin), 'get', '/api/admin/products/{id}', 404);
    expectContract(await send('PATCH', '/api/admin/products/61', admin, { active: false, salePriceCents: null }), 'patch', '/api/admin/products/{id}', 200);
    expectContract(await send('PATCH', '/api/admin/products/61', admin, {}), 'patch', '/api/admin/products/{id}', 400);
    expectContract(await send('PATCH', '/api/admin/products/999', admin, { name: 'Nope' }), 'patch', '/api/admin/products/{id}', 404);
    expectContract(await get('/api/products/61'), 'get', '/api/products/{id}', 404); // inactive: hidden from the public detail
    expectContract(await send('DELETE', '/api/admin/products/61', admin), 'delete', '/api/admin/products/{id}', 204);
    expectContract(await send('DELETE', '/api/admin/products/61', admin), 'delete', '/api/admin/products/{id}', 404);

    expectContract(await get('/api/admin/orders?status=Processing', admin), 'get', '/api/admin/orders', 200);
    expectContract(await get('/api/admin/orders?page=9', admin), 'get', '/api/admin/orders', 200);
    expectContract(await get('/api/admin/orders?status=Lost', admin), 'get', '/api/admin/orders', 400);
    expectContract(await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Shipped' }), 'patch', '/api/admin/orders/{id}/status', 200);
    expectContract(await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Processing' }), 'patch', '/api/admin/orders/{id}/status', 409);
    expectContract(await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Lost' }), 'patch', '/api/admin/orders/{id}/status', 400);
    expectContract(await send('PATCH', '/api/admin/orders/999/status', admin, { status: 'Shipped' }), 'patch', '/api/admin/orders/{id}/status', 404);

    expectContract(await get('/api/admin/users?q=shoplab', admin), 'get', '/api/admin/users', 200);
    expectContract(await get('/api/admin/users?pageSize=0', admin), 'get', '/api/admin/users', 400);
    expectContract(await send('PATCH', '/api/admin/users/3/lock', admin, { locked: false }), 'patch', '/api/admin/users/{id}/lock', 200);
    expectContract(await send('PATCH', '/api/admin/users/3/lock', admin, { locked: 'no' }), 'patch', '/api/admin/users/{id}/lock', 400);
    expectContract(await send('PATCH', '/api/admin/users/999/lock', admin, { locked: true }), 'patch', '/api/admin/users/{id}/lock', 404);
    expectContract(await send('PATCH', '/api/admin/users/4/lock', admin, { locked: true }), 'patch', '/api/admin/users/{id}/lock', 409);
  });

  it('test endpoints, including the key check', async () => {
    expectContract(await get('/api/test/state'), 'get', '/api/test/state', 200);
    const user = { email: 'made@shoplab.test', password: 'Made@12345', role: 'admin', locked: true };
    expectContract(await call(server, 'POST', '/api/test/users', { json: user }), 'post', '/api/test/users', 201);
    expectContract(await call(server, 'POST', '/api/test/users', { json: user }), 'post', '/api/test/users', 409);
    expectContract(await call(server, 'POST', '/api/test/users', { json: { email: 'x' } }), 'post', '/api/test/users', 400);
    expectContract(await call(server, 'POST', '/api/test/reset', { json: { scenario: 'nope' } }), 'post', '/api/test/reset', 400);
    expectContract(await call(server, 'POST', '/api/test/reset', { json: { scenario: 'default' } }), 'post', '/api/test/reset', 204);
    expectContract(await get('/api/test/flags'), 'get', '/api/test/flags', 200);
    expectContract(await call(server, 'POST', '/api/test/flags', { json: { enable: ['nope'] } }), 'post', '/api/test/flags', 400);
    expectContract(await call(server, 'POST', '/api/test/flags', { json: { preset: 'none' } }), 'post', '/api/test/flags', 200);
    const chaos = { latencyMs: 0, jitterMs: 0, failureRate: 0, paths: [], status: 503, deterministic: true };
    expectContract(await call(server, 'POST', '/api/test/chaos', { json: chaos }), 'post', '/api/test/chaos', 200);
    expectContract(await call(server, 'POST', '/api/test/chaos', { json: { latencyMs: 6000 } }), 'post', '/api/test/chaos', 400);
    expectContract(await get('/api/config'), 'get', '/api/config', 200);

    const keyed = await startTestServer('default', { testApiKey: 'secret' });
    try {
      expectContract(await call(keyed, 'GET', '/api/test/state'), 'get', '/api/test/state', 401);
    } finally {
      await keyed.close();
    }
  });

  it('serves the docs: Swagger UI page, its bundled files and the raw spec, with no outside address', async () => {
    const page = await fetch(`${server.baseUrl}/api/docs`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('/api/docs/assets/swagger-ui-bundle.js');
    expect(html).not.toMatch(/https?:\/\//);

    const raw = await fetch(`${server.baseUrl}/api/docs/openapi.yaml`);
    expect(raw.status).toBe(200);
    expect(await raw.text()).toBe(fs.readFileSync(specPath, 'utf8'));

    for (const asset of ['swagger-ui-bundle.js', 'swagger-ui.css']) {
      const res = await fetch(`${server.baseUrl}/api/docs/assets/${asset}`);
      expect(res.status, asset).toBe(200);
    }
    expect((await fetch(`${server.baseUrl}/api/docs/swagger-init.js`)).status).toBe(200);
    expect(path.basename(specPath)).toBe('openapi.yaml');
  });
});
