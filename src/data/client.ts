import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core';

/**
 * Any Drizzle SQLite database with synchronous results: `expo-sqlite` in the app,
 * Node's built-in `node:sqlite` in Jest. Repositories only depend on this type, so
 * the same code runs in both places.
 */
export type AtlasDatabase = SQLiteAsyncDatabase<'sync', any>;
