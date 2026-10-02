import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import { createSchema, dropAllTables } from './schema';

export type Db = Database;

/** Opens the database and makes sure a fresh, empty schema exists. */
export function openDatabase(dbPath: string): Db {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = MEMORY');
  db.pragma('synchronous = OFF');
  db.pragma('foreign_keys = ON');
  dropAllTables(db);
  createSchema(db);
  return db;
}
