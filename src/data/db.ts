import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';

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

/** Applies the committed drizzle-kit migrations on startup (Drizzle's Expo guide: `useMigrations`). */
export function useDatabaseMigrations() {
  return useMigrations(getDatabase(), migrations);
}
