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

const get = <T>(url: string, token?: string) => call<T>(server, 'GET', url, { token });

const illustrations = (id: number) => [1, 2, 3].map((n) => `/images/products/${id}/${n}.svg`);

describe('product pictures in the API', () => {
  it('lists the three illustrations of a seeded product, in the list and in the detail', async () => {
    const detail = await get<{ images: string[]; imagePath: string | null; imageCount: number }>('/api/products/4');
    expect(detail.body.images).toEqual(illustrations(4));
    expect(detail.body.imagePath).toBeNull();
    expect(detail.body.imageCount).toBe(3);

    const list = await get<{ data: { id: number; images: string[] }[] }>('/api/products?pageSize=50');
    expect(list.body.data.length).toBeGreaterThan(0);
    for (const product of list.body.data) expect(product.images).toEqual(illustrations(product.id));
  });

  it('gives the two Smart Lamps their own pictures', async () => {
    const a = await get<{ images: string[] }>('/api/products/4');
    const b = await get<{ images: string[] }>('/api/products/23');
    expect(a.body.images).not.toEqual(b.body.images);
  });

  it('shows the uploaded image instead of the illustrations, and goes back when it is removed', async () => {
    const form = new FormData();
    form.set('image', new Blob([new Uint8Array(TINY_PNG)], { type: 'image/png' }), 'one.png');
    const updated = await call<{ imagePath: string; images: string[] }>(server, 'PATCH', '/api/admin/products/5', { token: admin, form });
    expect(updated.status).toBe(200);
    expect(updated.body.images).toEqual([updated.body.imagePath]);
    expect((await get<{ images: string[] }>('/api/products/5')).body.images).toEqual([updated.body.imagePath]);

    const removed = await call<{ imagePath: string | null; images: string[] }>(server, 'PATCH', '/api/admin/products/5', { token: admin, json: { removeImage: true } });
    expect(removed.status).toBe(200);
    expect(removed.body.imagePath).toBeNull();
    expect(removed.body.images).toEqual(illustrations(5));
  });

  it('gives a product created without an image one illustration in its category colours', async () => {
    const created = await call<{ id: number; images: string[] }>(server, 'POST', '/api/admin/products', {
      token: admin,
      json: { name: 'Plain Mug', category: 'Home', subcategory: 'Kitchen', description: 'A plain mug.', priceCents: 900, stock: 4 },
    });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeGreaterThan(60);
    expect(created.body.images).toEqual(['/images/categories/home.svg']);
    expect((await get<{ images: string[] }>(`/api/products/${created.body.id}`)).body.images).toEqual(['/images/categories/home.svg']);
  });

  it('puts the pictures on cart lines and order lines', async () => {
    const added = await call(server, 'POST', '/api/cart/items', { token: customer, json: { productId: 6, quantity: 1 } });
    expect(added.status).toBeLessThan(300);
    const cart = await get<{ items: { productId: number; images: string[] }[] }>('/api/cart', customer);
    const line = cart.body.items.find((i) => i.productId === 6);
    expect(line?.images).toEqual(illustrations(6));

    const orders = await get<{ data: { id: number }[] }>('/api/orders', customer);
    expect(orders.body.data.length).toBeGreaterThan(0);
    const order = await get<{ items: { productId: number; images: string[] }[] }>(`/api/orders/${orders.body.data[0]!.id}`, customer);
    expect(order.body.items.length).toBeGreaterThan(0);
    for (const item of order.body.items) expect(item.images.length).toBeGreaterThan(0);
  });
});
