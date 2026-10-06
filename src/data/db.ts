import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import migrations from './migrations/migrations';

export const DATABASE_NAME = 'atlas.db';

let database: ExpoSQLiteDatabase | null = null;

/** Opens the on-device database once (expo-sqlite persists it across restarts). */
export function getDatabase(): ExpoSQLiteDatabase {
  if (!database) {
    const client = openDatabaseSync(DATABASE_NAME);
    // expo-sqlite docs: enable WAL on a new database. SQLite needs foreign keys turned on per connection.
    client.execSync('PRAGMA journal_mode = WAL;');
    client.execSync('PRAGMA foreign_keys = ON;');
    database = drizzle(client);
  }
  return database;
}

export type MigrationState = { success: boolean; error: Error | null };

/**
 * Applies the committed drizzle-kit migrations once, on startup.
 *
 * Drizzle's Expo guide offers `useMigrations` or calling `migrate()` in a `useEffect`.
 * This is the second form: in drizzle-orm 1.0.0-rc.4 the `useMigrations` type still
 * requires the pre-v1 `journal` field that drizzle-kit v1 no longer generates, while
 * `migrate()` is typed for the v1 `migrations.js`. Same runtime path either way.
 */
export function useDatabaseMigrations(): MigrationState {
  const [state, setState] = useState<MigrationState>({ success: false, error: null });

  useEffect(() => {
    let cancelled = false;
    migrate(getDatabase(), migrations)
      .then(() => {
        if (!cancelled) setState({ success: true, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ success: false, error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
