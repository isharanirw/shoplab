import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.resolve(__dirname, '..', '..');

function readVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export interface Config {
  port: number;
  dbPath: string;
  testApiKey: string | null;
  clientDistDir: string;
  seedDir: string;
  /** The OpenAPI document served at /api/docs/openapi.yaml. */
  openApiPath: string;
  /** Self-hosted scripts served at /ads and /analytics. */
  staticDir: string;
  /** Where review images are stored. Git-ignored and wiped by reset. */
  uploadsDir: string;
  version: string;
  logRequests: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3000);
  return {
    port: Number.isInteger(port) && port > 0 ? port : 3000,
    dbPath: env.DB_PATH && env.DB_PATH.length > 0 ? env.DB_PATH : path.join(rootDir, 'data', 'shoplab.sqlite'),
    testApiKey: env.TEST_API_KEY && env.TEST_API_KEY.length > 0 ? env.TEST_API_KEY : null,
    clientDistDir: path.join(rootDir, 'client', 'dist'),
    seedDir: path.join(rootDir, 'server', 'seed'),
    openApiPath: path.join(rootDir, 'docs', 'openapi.yaml'),
    staticDir: path.join(rootDir, 'server', 'static'),
    uploadsDir: env.UPLOADS_DIR && env.UPLOADS_DIR.length > 0 ? path.resolve(env.UPLOADS_DIR) : path.join(rootDir, 'uploads'),
    version: readVersion(),
    logRequests: env.LOG_REQUESTS !== 'false',
  };
}
