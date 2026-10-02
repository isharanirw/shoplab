import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, createContext } from '../app';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import type { Scenario } from '../db/seed';

export interface TestServer {
  db: Db;
  baseUrl: string;
  uploadsDir: string;
  close: () => Promise<void>;
}

/** Starts the real Express app on a free port with an in-memory database and a temporary uploads folder. */
export async function startTestServer(scenario: Scenario = 'default', options: { testApiKey?: string } = {}): Promise<TestServer> {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoplab-test-'));
  const config = { ...loadConfig({ LOG_REQUESTS: 'false' }), uploadsDir, testApiKey: options.testApiKey ?? null };
  const db = openDatabase(':memory:');
  seedDatabase(db, config.seedDir, scenario);
  const app = createApp(createContext(config, db));
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    db,
    baseUrl: `http://127.0.0.1:${port}`,
    uploadsDir,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          db.close();
          fs.rmSync(uploadsDir, { recursive: true, force: true });
          resolve();
        });
      }),
  };
}

export interface CallOptions {
  token?: string;
  json?: unknown;
  form?: FormData;
}

export interface CallResult<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

/** One request against the test server, returning the status, parsed JSON body (null when there is none) and headers. */
export async function call<T = unknown>(server: TestServer, method: string, url: string, options: CallOptions = {}): Promise<CallResult<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${server.baseUrl}${url}`, {
    method,
    headers,
    body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text === '' ? null : JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body: body as T, headers: response.headers };
}

export const DEMO_PASSWORDS: Record<string, string> = {
  'customer1@shoplab.test': 'Test@1234',
  'customer2@shoplab.test': 'Test@1234',
  'locked@shoplab.test': 'Test@1234',
  'admin@shoplab.test': 'Admin@1234',
};

/** Logs a seeded demo account in and returns its bearer token. */
export async function loginAs(server: TestServer, email: string): Promise<string> {
  const res = await call<{ token: string }>(server, 'POST', '/api/auth/login', {
    json: { email, password: DEMO_PASSWORDS[email] },
  });
  if (res.status !== 200) throw new Error(`Login as ${email} failed with ${res.status}`);
  return res.body.token;
}

/** A minimal valid PNG (1x1 pixel). */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
