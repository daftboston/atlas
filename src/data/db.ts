import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/migrations';

export const DATABASE_NAME = 'atlas.db';

let client: SQLiteDatabase | null = null;
let database: ExpoSQLiteDatabase | null = null;

/** Opens the on-device database once (expo-sqlite persists it across restarts). Throws if it can't be opened. */
export function getDatabase(): ExpoSQLiteDatabase {
  if (!database) {
    const opened = openDatabaseSync(DATABASE_NAME);
    try {
      // expo-sqlite docs: enable WAL on a new database. SQLite needs foreign keys turned on per connection.
      opened.execSync('PRAGMA journal_mode = WAL;');
      opened.execSync('PRAGMA foreign_keys = ON;');
    } catch (error) {
      closeQuietly(opened);
      throw error;
    }
    client = opened;
    database = drizzle(opened);
  }
  return database;
}

function closeQuietly(target: SQLiteDatabase | null) {
  try {
    target?.closeSync();
  } catch {
    // Nothing more to do. The next attempt opens a fresh connection.
  }
}

/** Forgets the cached connection, so the next `getDatabase()` opens a new one. */
export function resetDatabase() {
  closeQuietly(client);
  client = null;
  database = null;
}

let pending: Promise<ExpoSQLiteDatabase> | null = null;

/**
 * Opens the database and applies the committed drizzle-kit migrations (Drizzle's Expo guide).
 * Called from the async startup in `state/bootstrap.ts`, never during render, so a failure
 * reaches the startup error screen. Concurrent calls (React StrictMode runs effects twice in
 * development) share one run. On failure the half-open connection is dropped and the error is
 * rethrown, so a retry starts clean.
 */
export function openAndMigrateDatabase(): Promise<ExpoSQLiteDatabase> {
  if (!pending) {
    const run = (async () => {
      try {
        const db = getDatabase();
        await migrate(db, migrations);
        return db;
      } catch (error) {
        resetDatabase();
        throw error;
      }
    })();
    // Clear it after `pending` is assigned: an open failure rejects before the first await.
    pending = run;
    const clear = () => {
      if (pending === run) pending = null;
    };
    run.then(clear, clear);
  }
  return pending;
}
