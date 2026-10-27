/** @jest-environment node */
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';

import { openAndMigrateDatabase, resetDatabase } from './db';

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({ drizzle: jest.fn((client: unknown) => ({ client })) }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({ migrate: jest.fn() }));

const open = jest.mocked(openDatabaseSync);
const migrateDb = jest.mocked(migrate);

function fakeClient() {
  return { execSync: jest.fn(), closeSync: jest.fn() };
}

describe('openAndMigrateDatabase', () => {
  beforeEach(() => {
    resetDatabase();
    open.mockReset();
    migrateDb.mockReset();
  });

  it('rejects, instead of throwing synchronously, when the database cannot be opened, and a retry opens again', async () => {
    const good = fakeClient();
    open.mockImplementationOnce(() => {
      throw new Error('unable to open database file');
    });
    open.mockImplementationOnce(() => good as never);
    migrateDb.mockResolvedValue(undefined);

    await expect(openAndMigrateDatabase()).rejects.toThrow('unable to open database file');
    await expect(openAndMigrateDatabase()).resolves.toMatchObject({ client: good });
    expect(open).toHaveBeenCalledTimes(2);
    expect(good.execSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
  });

  it('closes the connection when a migration fails, so the retry starts on a fresh one', async () => {
    const first = fakeClient();
    const second = fakeClient();
    open.mockImplementationOnce(() => first as never).mockImplementationOnce(() => second as never);
    migrateDb.mockRejectedValueOnce(new Error('migration 0005 failed')).mockResolvedValueOnce(undefined);

    await expect(openAndMigrateDatabase()).rejects.toThrow('migration 0005 failed');
    expect(first.closeSync).toHaveBeenCalledTimes(1);

    await expect(openAndMigrateDatabase()).resolves.toMatchObject({ client: second });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('closes a connection whose pragmas fail', async () => {
    const broken = fakeClient();
    broken.execSync.mockImplementation(() => {
      throw new Error('database is locked');
    });
    open.mockImplementationOnce(() => broken as never);

    await expect(openAndMigrateDatabase()).rejects.toThrow('database is locked');
    expect(broken.closeSync).toHaveBeenCalledTimes(1);
  });

  it('shares one run between concurrent callers (StrictMode runs effects twice in development)', async () => {
    open.mockImplementation(() => fakeClient() as never);
    migrateDb.mockResolvedValue(undefined);

    const [a, b] = await Promise.all([openAndMigrateDatabase(), openAndMigrateDatabase()]);

    expect(a).toBe(b);
    expect(open).toHaveBeenCalledTimes(1);
    expect(migrateDb).toHaveBeenCalledTimes(1);
  });
});
