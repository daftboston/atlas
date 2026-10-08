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
    expect(migrations.journal.entries.map((entry) => entry.tag)).toEqual([
      '0000_init',
      '0001_kind_talisman',
      '0002_quick_ultimo',
    ]);
    expect(Object.keys(migrations.migrations)).toEqual(['m0000', 'm0001', 'm0002']);
    expect(migrations.migrations.m0000).toContain('CREATE TABLE `knowledge_items`');
    expect(migrations.migrations.m0001).toContain('CREATE TABLE `practice_sessions`');
    expect(migrations.migrations.m0002).toContain('CREATE TABLE `review_queue`');
  });

  it('create the learning-loop §3 tables the app uses today', async () => {
    expect(schemaOf(await openTestDatabase()).map((row) => row.name)).toEqual([
      'app_settings',
      'courses',
      'feedback',
      'feedback_attempt_id_unique',
      'knowledge_items',
      'knowledge_items_seed_id_unique',
      'practice_attempts',
      'practice_sessions',
      'review_logs',
      'review_logs_attempt_id_unique',
      'review_queue',
      'review_queue_due_idx',
      'saved_words',
    ]);
  });

  it('declare every primary key NOT NULL', async () => {
    const db = await openTestDatabase();
    for (const table of [
      'app_settings',
      'courses',
      'knowledge_items',
      'saved_words',
      'practice_sessions',
      'practice_attempts',
      'feedback',
      'review_queue',
      'review_logs',
    ]) {
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
      expect(second.all(sql`SELECT hash FROM __drizzle_migrations`)).toHaveLength(3);
      second.close();
    } finally {
      removeDatabaseFile(path);
    }
  });
});
