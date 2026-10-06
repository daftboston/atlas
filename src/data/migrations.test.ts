/** @jest-environment node */
import { sql } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate as migrateBundled } from 'drizzle-orm/expo-sqlite/migrator';
import { drizzle } from 'drizzle-orm/node-sqlite';

import type { AtlasDatabase } from './client';
import migrations from './migrations/migrations';
import { openTestDatabase } from './testDatabase';

function schemaOf(db: AtlasDatabase) {
  return db.all<{ name: string; sql: string }>(
    sql`SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
  );
}

describe('migrations', () => {
  it('create the learning-loop §3 tables the app uses today', () => {
    expect(schemaOf(openTestDatabase()).map((row) => row.name)).toEqual([
      'app_settings',
      'courses',
      'knowledge_items',
      'saved_words',
    ]);
  });

  it('the bundled migrations.js the app ships builds the same schema as the migration folders', async () => {
    // Same path as the app: babel-plugin-inline-import inlines the .sql files, then
    // drizzle's expo-sqlite migrator applies them (here against node:sqlite).
    const bundled = drizzle(':memory:');
    await migrateBundled(bundled as unknown as ExpoSQLiteDatabase, migrations);

    expect(schemaOf(bundled)).toEqual(schemaOf(openTestDatabase()));
  });
});
