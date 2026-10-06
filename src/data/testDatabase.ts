// Test-only helper (imported by *.test.ts, never by the app). Opens a real SQLite
// database with Node's built-in `node:sqlite` driver, which Drizzle supports, and
// applies the committed drizzle-kit migrations from src/data/migrations.
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';

import type { AtlasDatabase } from './client';

export const MIGRATIONS_FOLDER = 'src/data/migrations';

/** `path` defaults to an in-memory database. Pass a file path to test reopening. */
export function openTestDatabase(path = ':memory:'): AtlasDatabase & { close(): void } {
  const db = drizzle(path);
  db.$client.exec('PRAGMA foreign_keys = ON;');
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return Object.assign(db, { close: () => db.$client.close() });
}

/** Unique temp file path for a database that must survive a reconnect. */
export function tempDatabasePath(): string {
  const dir = process.env.TMPDIR ?? '/tmp';
  return `${dir.replace(/\/$/, '')}/atlas-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
}

export function removeDatabaseFile(path: string) {
  const fs = jest.requireActual('fs') as { rmSync(path: string, options: { force: boolean }): void };
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${path}${suffix}`, { force: true });
}
