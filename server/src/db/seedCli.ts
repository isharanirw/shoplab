import { loadConfig } from '../config';
import { openDatabase } from './connection';
import { seedDatabase } from './seed';

// Rebuilds the SQLite file from the JSON seed. The server also does this on every boot.
const config = loadConfig();
const db = openDatabase(config.dbPath);
const started = Date.now();
seedDatabase(db, config.seedDir, 'default');
const products = (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n;
const users = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
console.log(`Seeded ${config.dbPath}: ${users} users, ${products} products in ${Date.now() - started} ms`);
db.close();
