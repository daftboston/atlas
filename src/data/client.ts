import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * A Drizzle SQLite database with synchronous results, as the expo-sqlite driver
 * returns. Repositories depend on this type (transactions included), not on expo-sqlite.
 */
export type AtlasDatabase = BaseSQLiteDatabase<'sync', any>;
