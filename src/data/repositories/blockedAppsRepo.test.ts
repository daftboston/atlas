/** @jest-environment node */
import { createSessionRepo } from './sessionRepo';
import { createSettingsRepo } from './settingsRepo';
import { createBlockedAppsRepo } from './blockedAppsRepo';
import { DEFAULT_COURSE } from '../seed/courses';
import { loadSeed } from '../seed/loadSeed';
import { openTestDatabase, removeDatabaseFile, tempDatabasePath } from '../testDatabase';

let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

describe('blocked apps repository', () => {
  it('starts empty', async () => {
    expect(createBlockedAppsRepo(await openTestDatabase()).list()).toEqual([]);
  });

  it('selects apps as locked, keeps the state of apps that stay, and drops the rest', async () => {
    const repo = createBlockedAppsRepo(await openTestDatabase());
    repo.select(['instagram', 'tiktok'], 1);
    expect(repo.list().map((row) => [row.appId, row.state]).sort()).toEqual([['instagram', 'locked'], ['tiktok', 'locked']]);

    repo.save('instagram', 'relocked', null, 2);
    repo.select(['instagram', 'x'], 3);
    expect(repo.list().map((row) => [row.appId, row.state]).sort()).toEqual([['instagram', 'relocked'], ['x', 'locked']]);

    repo.select([], 4);
    expect(repo.list()).toEqual([]);
  });

  it('reports the status of the practice session saved on an app', async () => {
    const db = await openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, Date.now());
    createSettingsRepo(db).set('activeCourseId', 'en-es-v0');
    const sessions = createSessionRepo(db);
    const started = sessions.start('daily', Date.now(), 'America/Bogota');
    if (started.kind !== 'started') throw new Error('expected a session');

    const repo = createBlockedAppsRepo(db);
    repo.select(['instagram'], 1);
    expect(repo.list()[0]!.sessionStatus).toBeNull();

    repo.save('instagram', 'practicing', started.id, 2);
    expect(repo.list()[0]).toMatchObject({ state: 'practicing', sessionId: started.id, sessionStatus: 'active' });

    sessions.abandon(started.id, Date.now());
    expect(repo.list()[0]!.sessionStatus).toBe('abandoned');
  });

  it('keeps the choice and the state across closing and reopening the database', async () => {
    const path = tempDatabasePath();
    try {
      const first = await openTestDatabase(path);
      const repo = createBlockedAppsRepo(first);
      repo.select(['instagram', 'youtube'], 1);
      repo.save('youtube', 'relocked', null, 2);
      first.close();

      const second = await openTestDatabase(path);
      expect(createBlockedAppsRepo(second).list().map((row) => [row.appId, row.state]).sort()).toEqual([['instagram', 'locked'], ['youtube', 'relocked']]);
      second.close();
    } finally {
      removeDatabaseFile(path);
    }
  });

  it('rejects a state outside the four', async () => {
    const db = await openTestDatabase();
    const repo = createBlockedAppsRepo(db);
    repo.select(['instagram'], 1);
    expect(() => repo.save('instagram', 'bogus' as never, null, 2)).toThrow();
  });
});
