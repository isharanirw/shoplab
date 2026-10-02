import fs from 'node:fs';
import path from 'node:path';
import { createApp, createContext } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/connection';
import { seedDatabase } from './db/seed';
import { clearUploads } from './services/uploads';

// Optional local overrides; real environment variables always win.
const envFile = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const db = openDatabase(config.dbPath);
const seedStart = Date.now();
seedDatabase(db, config.seedDir, 'default');
clearUploads(config.uploadsDir); // the database starts fresh on every boot, so stale review images go too

const ctx = createContext(config, db);
const app = createApp(ctx);

const server = app.listen(config.port, () => {
  process.stdout.write(
    `ShopLab ${config.version} listening on port ${config.port} (seeded in ${Date.now() - seedStart} ms, ` +
      `test key ${config.testApiKey ? 'required' : 'not required'})\n`,
  );
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
