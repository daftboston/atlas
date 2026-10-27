/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import type { AtlasDatabase } from './client';
import migrations from './migrations/migrations';
import { practiceSessions, unlockGrants } from './schema';
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
      '0003_large_kingpin',
      '0004_abandon_extra_active_sessions',
      '0005_practice_sessions_single_active',
    ]);
    expect(Object.keys(migrations.migrations)).toEqual(['m0000', 'm0001', 'm0002', 'm0003', 'm0004', 'm0005']);
    expect(migrations.migrations.m0000).toContain('CREATE TABLE `knowledge_items`');
    expect(migrations.migrations.m0001).toContain('CREATE TABLE `practice_sessions`');
    expect(migrations.migrations.m0002).toContain('CREATE TABLE `review_queue`');
    expect(migrations.migrations.m0003).toContain('CREATE TABLE `unlock_grants`');
    expect(migrations.migrations.m0005).toContain('CREATE UNIQUE INDEX `practice_sessions_single_active`');
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
      'practice_sessions_single_active',
      'review_logs',
      'review_logs_attempt_id_unique',
      'review_queue',
      'review_queue_due_idx',
      'saved_words',
      'unlock_grants',
      'unlock_grants_session_id_unique',
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
      'unlock_grants',
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
      expect(second.all(sql`SELECT hash FROM __drizzle_migrations`)).toHaveLength(6);
      second.close();
    } finally {
      removeDatabaseFile(path);
    }
  });

  describe('0004 and 0005: a single active session', () => {
    const T = Date.parse('2026-10-20T15:00:00.000Z');
    const session = (id: string, status: 'active' | 'completed' | 'abandoned', startedAt: number) => ({
      id,
      startedAt,
      endedAt: status === 'active' ? null : startedAt + 60_000,
      mode: 'daily' as const,
      status,
      plannedItemIds: [],
      cursor: 0,
    });
    /** The journal up to 0003: the schema as it shipped before the unique index. */
    const before = {
      journal: { ...migrations.journal, entries: migrations.journal.entries.slice(0, 4) },
      migrations: migrations.migrations,
    };

    it('upgrades a database with data: extra active sessions are abandoned, everything else is kept', async () => {
      const path = tempDatabasePath();
      try {
        const old = await openTestDatabase(path, before);
        expect(old.all(sql`SELECT name FROM sqlite_master WHERE name = 'practice_sessions_single_active'`)).toHaveLength(0);
        // Two active sessions can exist in the old schema, which is the bug the index closes.
        old
          .insert(practiceSessions)
          .values([
            session('done', 'completed', T),
            session('gone', 'abandoned', T + 1_000),
            session('old-active', 'active', T + 2_000),
            session('new-active', 'active', T + 3_000),
          ])
          .run();
        old
          .insert(unlockGrants)
          .values({
            id: 'grant',
            sessionId: 'done',
            minutes: 10,
            status: 'earned',
            earnedAt: T,
            activatedAt: null,
            expiresAt: null,
            expiresUnusedAt: T + 60_000,
            screenTimeApplied: false,
          })
          .run();
        old.close();

        const upgraded = await openTestDatabase(path);
        const rows = upgraded.select().from(practiceSessions).all();
        const status = Object.fromEntries(rows.map((row) => [row.id, row.status]));
        expect(status).toEqual({ done: 'completed', gone: 'abandoned', 'old-active': 'abandoned', 'new-active': 'active' });
        const abandoned = rows.find((row) => row.id === 'old-active');
        expect(abandoned?.endedAt).toBeGreaterThan(T);
        // Rows that were not touched keep their values.
        expect(rows.find((row) => row.id === 'done')).toMatchObject({ endedAt: T + 60_000, startedAt: T });
        expect(upgraded.select().from(unlockGrants).where(eq(unlockGrants.id, 'grant')).get()?.status).toBe('earned');
        expect(upgraded.all(sql`SELECT hash FROM __drizzle_migrations`)).toHaveLength(6);
        upgraded.close();
      } finally {
        removeDatabaseFile(path);
      }
    });

    it('upgrades a database with no active session, and one with exactly one, without changing them', async () => {
      for (const initial of [[], [session('only', 'active', T)]]) {
        const path = tempDatabasePath();
        try {
          const old = await openTestDatabase(path, before);
          if (initial.length > 0) old.insert(practiceSessions).values(initial).run();
          old.close();
          const upgraded = await openTestDatabase(path);
          expect(upgraded.select().from(practiceSessions).all().map((row) => row.status)).toEqual(initial.map((row) => row.status));
          upgraded.close();
        } finally {
          removeDatabaseFile(path);
        }
      }
    });

    it('rejects a second active session, and still allows any number of finished ones', async () => {
      const db = await openTestDatabase();
      db.insert(practiceSessions).values(session('a', 'active', T)).run();
      expect(() => db.insert(practiceSessions).values(session('b', 'active', T + 1)).run()).toThrow(/UNIQUE|unique/);
      db.insert(practiceSessions)
        .values([
          session('c', 'completed', T),
          session('d', 'completed', T + 1),
          session('e', 'abandoned', T + 2),
          session('f', 'abandoned', T + 3),
        ])
        .run();
      // Finishing the active one frees the slot.
      db.update(practiceSessions).set({ status: 'completed' }).where(eq(practiceSessions.id, 'a')).run();
      db.insert(practiceSessions).values(session('g', 'active', T + 4)).run();
      expect(db.select().from(practiceSessions).where(eq(practiceSessions.status, 'active')).all()).toHaveLength(1);
      db.close();
    });
  });
});
