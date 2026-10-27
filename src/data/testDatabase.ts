// Test-only helper (imported by *.test.ts, never by the app). Runs the app's real
// Drizzle expo-sqlite driver and bundled migrations against an in-process SQLite.
//
// expo-sqlite is a native module, so Jest can't open it. Instead, a small adapter gives
// Node's built-in `node:sqlite` the synchronous expo-sqlite methods Drizzle's expo driver
// calls (prepareSync / executeSync / executeForRawResultSync / execSync). Everything
// above the client (query building, transactions, migrator, migrations.js) is the code
// that runs on the device.
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import type { SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/migrations';

type SQLValue = string | number | bigint | null | Uint8Array;
type Row = Record<string, unknown>;

/** The parts of node:sqlite (Node >= 22.13) this adapter uses. */
type NodeStatement = {
  all(...params: SQLValue[]): unknown[];
  get(...params: SQLValue[]): unknown;
  run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  columns(): unknown[];
  setReturnArrays(enabled: boolean): void;
};
type NodeDatabase = {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
};
type NodeSqlite = { DatabaseSync: new (path: string) => NodeDatabase };

function toParams(params: unknown[] = []): SQLValue[] {
  return params.map((value) => (typeof value === 'boolean' ? Number(value) : (value as SQLValue)));
}

/** A statement that runs as the expo-sqlite `SQLiteStatement` sync API does. */
function prepareSync(database: NodeDatabase, sql: string) {
  const execute = (statement: NodeStatement, params: SQLValue[]) => {
    if (statement.columns().length === 0) {
      const { changes, lastInsertRowid } = statement.run(...params);
      return { rows: [] as unknown[], changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    }
    return { rows: statement.all(...params), changes: 0, lastInsertRowId: 0 };
  };
  const result = (rows: unknown[], changes: number, lastInsertRowId: number) => ({
    changes,
    lastInsertRowId,
    getAllSync: () => rows,
    getFirstSync: () => rows[0] ?? null,
    resetSync: () => {},
  });

  return {
    executeSync(params?: unknown[]) {
      const { rows, changes, lastInsertRowId } = execute(database.prepare(sql), toParams(params));
      return result(rows as Row[], changes, lastInsertRowId);
    },
    executeForRawResultSync(params?: unknown[]) {
      const statement = database.prepare(sql);
      statement.setReturnArrays(true);
      const { rows, changes, lastInsertRowId } = execute(statement, toParams(params));
      return result(rows, changes, lastInsertRowId);
    },
    finalizeSync: () => {},
  };
}

function openExpoCompatibleClient(path: string) {
  const { DatabaseSync } = jest.requireActual('node:sqlite') as NodeSqlite;
  const database = new DatabaseSync(path);
  const client = {
    prepareSync: (sql: string) => prepareSync(database, sql),
    execSync: (sql: string) => database.exec(sql),
    closeSync: () => database.close(),
  };
  return client as unknown as SQLiteDatabase & { closeSync(): void };
}

type MigrationConfig = Parameters<typeof migrate>[1];

export type TestDatabase = ExpoSQLiteDatabase & { close(): void };

/**
 * Opens a database through the expo-sqlite Drizzle driver and applies the bundled
 * migrations (migrations.js) with Drizzle's expo migrator, as the app does on startup.
 * `path` defaults to an in-memory database; pass a file path to test reopening. `config` defaults
 * to every bundled migration; pass a truncated one to build an older database for upgrade tests.
 */
export async function openTestDatabase(path = ':memory:', config: MigrationConfig = migrations): Promise<TestDatabase> {
  const client = openExpoCompatibleClient(path);
  client.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(client);
  await migrate(db, config);
  return Object.assign(db, { close: () => client.closeSync() });
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
