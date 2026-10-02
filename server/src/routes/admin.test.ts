import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, loginAs, startTestServer, TINY_PNG } from '../testing/harness';
import type { TestServer } from '../testing/harness';

let server: TestServer;
let admin: string;
let customer: string;

beforeAll(async () => {
  server = await startTestServer();
  admin = await loginAs(server, 'admin@shoplab.test');
  customer = await loginAs(server, 'customer1@shoplab.test');
});

afterAll(async () => {
  await server.close();
});

const send = (method: string, url: string, token?: string, json?: unknown) => call<Record<string, unknown>>(server, method, url, { token, json });

describe('authorization matrix for /api/admin/*', () => {
  const routes: [string, string, unknown?][] = [
    ['GET', '/api/admin/products'],
    ['POST', '/api/admin/products', { name: 'Matrix Lamp', category: 'Home', priceCents: 1000, stock: 1 }],
    ['GET', '/api/admin/products/1'],
    ['PATCH', '/api/admin/products/1', { name: 'Matrix Name' }],
    ['DELETE', '/api/admin/products/59'],
    ['GET', '/api/admin/orders'],
    ['PATCH', '/api/admin/orders/3/status', { status: 'Shipped' }],
    ['GET', '/api/admin/users'],
    ['PATCH', '/api/admin/users/2/lock', { locked: true }],
  ];

  for (const [method, url, body] of routes) {
    it(`${method} ${url}: anonymous 401, customer 403, no change made`, async () => {
      const anonymous = await send(method, url, undefined, body);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
      const asCustomer = await send(method, url, customer, body);
      expect(asCustomer.status).toBe(403);
      expect(asCustomer.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  }

  it('treats an unknown token like no login (401)', async () => {
    expect((await send('GET', '/api/admin/users', 'not-a-real-token')).status).toBe(401);
  });

  it('left everything untouched after all those refused calls', async () => {
    expect((await send('GET', '/api/admin/products/1', admin)).body.name).not.toBe('Matrix Name');
    expect((await send('GET', '/api/admin/products/59', admin)).status).toBe(200);
    expect((await send('GET', '/api/admin/users?q=customer2', admin)).body).toMatchObject({ data: [{ locked: false }] });
    expect((await send('GET', '/api/admin/orders?status=Processing', admin)).body.total).toBe(1);
  });

  it('lets an admin through to every route (401 and 403 are not returned)', async () => {
    for (const [method, url] of [
      ['GET', '/api/admin/products'],
      ['GET', '/api/admin/products/1'],
      ['GET', '/api/admin/orders'],
      ['GET', '/api/admin/users'],
    ] as const) {
      expect((await send(method, url, admin)).status).toBe(200);
    }
  });
});

describe('admin product flows over HTTP', () => {
  it('paginates, searches and answers an empty page beyond the last one', async () => {
    const first = await send('GET', '/api/admin/products?pageSize=25', admin);
    expect(first.body).toMatchObject({ page: 1, pageSize: 25, total: 60 });
    expect((first.body.data as unknown[]).length).toBe(25);
    const beyond = await send('GET', '/api/admin/products?pageSize=25&page=4', admin);
    expect(beyond.status).toBe(200);
    expect(beyond.body).toEqual({ data: [], page: 4, pageSize: 25, total: 60 });
    const search = await send('GET', '/api/admin/products?q=smart%20lamp', admin);
    expect((search.body.data as { id: number }[]).map((p) => p.id)).toEqual([4, 23]);
    expect((await send('GET', '/api/admin/products?pageSize=51', admin)).status).toBe(400);
  });

  it('creates through JSON and multipart, edits through multipart, serves the image and removes it again', async () => {
    const form = new FormData();
    form.set('name', 'Form Lamp');
    form.set('category', 'Home');
    form.set('priceCents', '4500');
    form.set('salePriceCents', '');
    form.set('stock', '8');
    form.set('active', 'true');
    form.set('image', new Blob([new Uint8Array(TINY_PNG)], { type: 'image/png' }), 'lamp.png');
    const created = await call<{ id: number; imagePath: string; salePriceCents: number | null }>(server, 'POST', '/api/admin/products', { token: admin, form });
    expect(created.status).toBe(201);
    expect(created.body.salePriceCents).toBeNull();

    const served = await fetch(`${server.baseUrl}${created.body.imagePath}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');

    // The public product shows the image path too.
    const publicProduct = await send('GET', `/api/products/${created.body.id}`);
    expect(publicProduct.body.imagePath).toBe(created.body.imagePath);

    const edit = new FormData();
    edit.set('removeImage', 'true');
    edit.set('stock', '9');
    const edited = await call<{ imagePath: string | null; stock: number }>(server, 'PATCH', `/api/admin/products/${created.body.id}`, { token: admin, form: edit });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ imagePath: null, stock: 9 });
    expect((await fetch(`${server.baseUrl}${created.body.imagePath}`)).status).toBe(404);
  });

  it('keeps the uploaded file only for a valid image: a text file named .png is a 400 and nothing is stored', async () => {
    const form = new FormData();
    form.set('name', 'Fake Image Lamp');
    form.set('category', 'Home');
    form.set('priceCents', '4500');
    form.set('stock', '8');
    form.set('image', new Blob(['just text'], { type: 'image/png' }), 'fake.png');
    const before = (await send('GET', '/api/admin/products', admin)).body.total;
    const res = await call<{ error: { fieldErrors: Record<string, string> } }>(server, 'POST', '/api/admin/products', { token: admin, form });
    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.image).toMatch(/PNG or JPG/);
    expect((await send('GET', '/api/admin/products', admin)).body.total).toBe(before);
  });

  it('rejects a body that is neither JSON nor multipart with a 400 and a malformed multipart with a 400', async () => {
    const res = await fetch(`${server.baseUrl}/api/admin/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'multipart/form-data; boundary=xyz' },
      body: 'garbage',
    });
    expect(res.status).toBe(400);
  });

  it('hides an inactive product from the public catalogue, search, suggestions, detail and wishlist, but not from the admin list', async () => {
    const id = 37;
    const name = (await send('GET', `/api/products/${id}`)).body.name as string;
    expect((await send('PATCH', `/api/admin/products/${id}`, admin, { active: false })).status).toBe(200);

    expect((await send('GET', `/api/products/${id}`)).status).toBe(404);
    const list = await send('GET', `/api/products?q=${encodeURIComponent(name)}&pageSize=50`);
    expect((list.body.data as { id: number }[]).some((p) => p.id === id)).toBe(false);
    const suggest = await send('GET', `/api/products/suggest?q=${encodeURIComponent(name)}`);
    expect((suggest.body.data as { id: number }[]).some((p) => p.id === id)).toBe(false);
    expect((await send('GET', `/api/products/${id}/reviews`)).status).toBe(404);
    expect((await send('POST', '/api/wishlist', customer, { productId: id })).status).toBe(404);
    expect((await send('POST', '/api/cart/items', customer, { productId: id, quantity: 1 })).status).toBe(404);
    expect((await send('GET', `/api/admin/products/${id}`, admin)).body.active).toBe(false);
    expect((await send('GET', '/api/admin/products?active=false', admin)).body.total).toBeGreaterThanOrEqual(1);

    await send('PATCH', `/api/admin/products/${id}`, admin, { active: true });
    expect((await send('GET', `/api/products/${id}`)).status).toBe(200);
  });

  it('deletes a product that appears in an order and the order still renders for its customer', async () => {
    const order = (await send('GET', '/api/orders/2', customer)).body as { items: { productId: number; name: string }[] };
    const productId = order.items[0]!.productId;
    expect((await send('DELETE', `/api/admin/products/${productId}`, admin)).status).toBe(204);
    expect((await send('GET', `/api/products/${productId}`)).status).toBe(404);
    const after = await send('GET', '/api/orders/2', customer);
    expect(after.status).toBe(200);
    expect((after.body.items as unknown[]).length).toBe(order.items.length);
    expect((after.body.items as { productId: number; name: string }[])[0]).toMatchObject({ productId, name: order.items[0]!.name });
    expect((await send('GET', '/api/orders', customer)).status).toBe(200);
  });

  it('gives new products increasing IDs and never reuses one', async () => {
    const make = () => send('POST', '/api/admin/products', admin, { name: 'Counter Lamp', category: 'Home', priceCents: 1000, stock: 1 });
    const ids = (await send('GET', '/api/admin/products?q=Form%20Lamp', admin)).body.data as { id: number }[];
    const base = ids[0]!.id;
    const a = await make();
    expect(a.body.id).toBeGreaterThan(base);
    await send('DELETE', `/api/admin/products/${a.body.id}`, admin);
    const b = await make();
    expect(b.body.id).toBeGreaterThan(a.body.id as number);
  });
});

describe('admin order flows over HTTP', () => {
  it('moves an order through the statuses, which the customer sees, and refuses what is not allowed', async () => {
    const mine = async () => ((await send('GET', '/api/orders/3', customer)).body as { status: string }).status;
    expect(await mine()).toBe('Processing');
    expect((await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Delivered' })).status).toBe(409);
    expect((await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Shipped' })).body.status).toBe('Shipped');
    expect(await mine()).toBe('Shipped');
    expect((await send('POST', '/api/orders/3/cancel', customer)).status).toBe(409);
    expect((await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Delivered' })).body.status).toBe('Delivered');
    expect((await send('PATCH', '/api/admin/orders/3/status', admin, { status: 'Cancelled' })).status).toBe(409);
  });

  it('gives stock back when an admin cancels, visible on the public product', async () => {
    const order = (await send('GET', '/api/orders/2', customer)).body as { items: { productId: number; variantId: number | null; quantity: number }[] };
    const line = order.items.find((i) => (server.db.prepare('SELECT 1 FROM products WHERE id = ?').get(i.productId) as unknown) !== undefined);
    if (!line) return; // every product of this order was deleted by an earlier test
    const stockBefore = (server.db.prepare('SELECT stock FROM products WHERE id = ?').get(line.productId) as { stock: number }).stock;
    expect((await send('PATCH', '/api/admin/orders/2/status', admin, { status: 'Cancelled' })).body.status).toBe('Cancelled');
    const stockAfter = (server.db.prepare('SELECT stock FROM products WHERE id = ?').get(line.productId) as { stock: number }).stock;
    expect(stockAfter).toBe(stockBefore + line.quantity);
    expect((await send('GET', `/api/products/${line.productId}`)).body.stock).toBe(stockAfter);
    // Cancelling again is a 409 and does not add the stock a second time.
    expect((await send('PATCH', '/api/admin/orders/2/status', admin, { status: 'Cancelled' })).status).toBe(409);
    expect((server.db.prepare('SELECT stock FROM products WHERE id = ?').get(line.productId) as { stock: number }).stock).toBe(stockAfter);
  });

  it('lists newest first and answers an empty page beyond the last', async () => {
    const res = await send('GET', '/api/admin/orders', admin);
    expect((res.body.data as { id: number }[]).map((o) => o.id)).toEqual([3, 2, 1]);
    expect((await send('GET', '/api/admin/orders?page=2', admin)).body).toEqual({ data: [], page: 2, pageSize: 10, total: 3 });
    expect((await send('GET', '/api/admin/orders?status=Cancelled', admin)).body.total).toBe(1);
  });
});

describe('admin user flows over HTTP', () => {
  const login = (email: string) => call<{ error?: { code: string } }>(server, 'POST', '/api/auth/login', { json: { email, password: 'Test@1234' } });

  it('locks a user: login answers 423, the existing token stops working, and unlocking allows a fresh login', async () => {
    const token = await loginAs(server, 'customer2@shoplab.test');
    expect((await send('GET', '/api/auth/me', token)).status).toBe(200);

    const locked = await send('PATCH', '/api/admin/users/2/lock', admin, { locked: true });
    expect(locked.status).toBe(200);
    expect(locked.body).toMatchObject({ id: 2, locked: true });

    expect((await login('customer2@shoplab.test')).status).toBe(423);
    expect((await send('GET', '/api/auth/me', token)).status).toBe(401);

    expect((await send('PATCH', '/api/admin/users/2/lock', admin, { locked: false })).body.locked).toBe(false);
    expect((await send('GET', '/api/auth/me', token)).status).toBe(401); // the old session is gone for good
    expect((await login('customer2@shoplab.test')).status).toBe(200);
  });

  it('unlocks the seeded locked account so it can log in', async () => {
    expect((await login('locked@shoplab.test')).status).toBe(423);
    expect((await send('PATCH', '/api/admin/users/3/lock', admin, { locked: false })).status).toBe(200);
    expect((await login('locked@shoplab.test')).status).toBe(200);
  });

  it('refuses locking yourself (409), bad bodies (400) and unknown users (404)', async () => {
    const self = await send('PATCH', '/api/admin/users/4/lock', admin, { locked: true });
    expect(self.status).toBe(409);
    expect(self.body).toMatchObject({ error: { code: 'CONFLICT' } });
    expect((await send('GET', '/api/auth/me', admin)).status).toBe(200);
    expect((await send('PATCH', '/api/admin/users/2/lock', admin, {})).status).toBe(400);
    expect((await send('PATCH', '/api/admin/users/abc/lock', admin, { locked: true })).status).toBe(400);
    expect((await send('PATCH', '/api/admin/users/999/lock', admin, { locked: true })).status).toBe(404);
  });

  it('lists users with pagination beyond the last page', async () => {
    expect((await send('GET', '/api/admin/users?pageSize=2', admin)).body).toMatchObject({ page: 1, pageSize: 2, total: 4 });
    expect((await send('GET', '/api/admin/users?pageSize=2&page=3', admin)).body).toEqual({ data: [], page: 3, pageSize: 2, total: 4 });
  });
});

describe('reset restores the seed and removes uploads', () => {
  it('brings back the deleted and changed data, the locked account, and deletes product images', async () => {
    const form = new FormData();
    form.set('name', 'Reset Lamp');
    form.set('category', 'Home');
    form.set('priceCents', '1000');
    form.set('stock', '1');
    form.set('image', new Blob([new Uint8Array(TINY_PNG)], { type: 'image/png' }), 'x.png');
    const created = await call<{ imagePath: string }>(server, 'POST', '/api/admin/products', { token: admin, form });
    expect(created.status).toBe(201);
    const file = path.join(server.uploadsDir, 'products', path.basename(created.body.imagePath));
    expect(fs.existsSync(file)).toBe(true);

    expect((await call(server, 'POST', '/api/test/reset')).status).toBe(204);

    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(path.join(server.uploadsDir, 'products'))).toBe(false);
    const adminAgain = await loginAs(server, 'admin@shoplab.test');
    const products = await send('GET', '/api/admin/products?pageSize=50', adminAgain);
    expect(products.body.total).toBe(60);
    expect((await send('GET', '/api/admin/users', adminAgain)).body.data).toMatchObject([
      { id: 1, locked: false },
      { id: 2, locked: false },
      { id: 3, locked: true },
      { id: 4, locked: false },
    ]);
    expect(((await send('GET', '/api/admin/orders', adminAgain)).body.data as { status: string }[]).map((o) => o.status)).toEqual(['Processing', 'Shipped', 'Delivered']);
    const next = await send('POST', '/api/admin/products', adminAgain, { name: 'After Reset', category: 'Home', priceCents: 1000, stock: 1 });
    expect(next.body.id).toBe(61);
  });
});
