/** @jest-environment node */
import { sql } from 'drizzle-orm';

import type { AtlasDatabase } from './client';
import migrations from './migrations/migrations';
import { openTestDatabase, removeDatabaseFile, tempDatabasePath } from './testDatabase';

function schemaOf(db: AtlasDatabase) {
  return db.all<{ name: string; sql: string }>(
    sql`SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
  );
}

describe('migrations', () => {
  it('bundle one SQL file per journal entry (babel-plugin-inline-import inlines the .sql)', () => {
    expect(migrations.journal.entries.map((entry) => entry.tag)).toEqual(['0000_init']);
    expect(Object.keys(migrations.migrations)).toEqual(['m0000']);
    expect(migrations.migrations.m0000).toContain('CREATE TABLE `knowledge_items`');
  });

  it('create the learning-loop §3 tables the app uses today', async () => {
    expect(schemaOf(await openTestDatabase()).map((row) => row.name)).toEqual([
      'app_settings',
      'courses',
      'knowledge_items',
      'knowledge_items_seed_id_unique',
      'saved_words',
    ]);
  });

  it('declare every primary key NOT NULL', async () => {
    const db = await openTestDatabase();
    for (const table of ['app_settings', 'courses', 'knowledge_items', 'saved_words']) {
      const columns = db.all<{ name: string; notnull: number; pk: number }>(sql.raw(`PRAGMA table_info(${table})`));
      const keys = columns.filter((column) => column.pk > 0);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect({ table, column: key.name, notnull: key.notnull }).toEqual({ table, column: key.name, notnull: 1 });
    }
  });

  it('apply once: reopening a migrated file database is a no-op', async () => {
    const path = tempDatabasePath();
    try {
      const first = await openTestDatabase(path);
      const before = schemaOf(first);
      first.close();
      const second = await openTestDatabase(path);
      expect(schemaOf(second)).toEqual(before);
      expect(second.all(sql`SELECT hash FROM __drizzle_migrations`)).toHaveLength(1);
      second.close();
    } finally {
      removeDatabaseFile(path);
    }
  });
});
