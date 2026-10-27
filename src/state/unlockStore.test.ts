/** @jest-environment node */
import { practiceSessions, unlockGrants } from '@/data/schema';
import { openTestDatabase, type TestDatabase } from '@/data/testDatabase';
import { createUnlockRepo } from '@/data/repositories/unlockRepo';

import { activateGrant, hydrateUnlock, resetUnlock } from './unlockStore';

const NOW = Date.parse('2026-10-07T15:00:00.000Z');

describe('unlock store', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await openTestDatabase();
    db.insert(practiceSessions)
      .values({ id: 's1', startedAt: NOW, endedAt: NOW, mode: 'daily', status: 'completed', plannedItemIds: [], cursor: 1 })
      .run();
    db.insert(unlockGrants)
      .values({
        id: 'g1',
        sessionId: 's1',
        minutes: 10,
        status: 'earned',
        earnedAt: NOW,
        activatedAt: null,
        expiresAt: null,
        expiresUnusedAt: NOW + 60_000,
        screenTimeApplied: false,
      })
      .run();
    hydrateUnlock(createUnlockRepo(db), NOW);
  });

  afterEach(() => {
    resetUnlock();
    db.close();
  });

  it('activates an earned grant before its rollover', async () => {
    await activateGrant('g1', NOW + 1_000);
    expect(createUnlockRepo(db).list()[0]).toMatchObject({ status: 'active', expiresAt: NOW + 1_000 + 600_000 });
  });

  it('does not activate a grant past its rollover, and leaves it forfeited', async () => {
    await activateGrant('g1', NOW + 60_000);
    expect(createUnlockRepo(db).list()[0]).toMatchObject({ status: 'forfeited', activatedAt: null, expiresAt: null });
  });

  it('does not restart a running grant when Activate is pressed again', async () => {
    await activateGrant('g1', NOW);
    const first = createUnlockRepo(db).list()[0]?.expiresAt;
    await activateGrant('g1', NOW + 120_000);
    expect(createUnlockRepo(db).list()[0]?.expiresAt).toBe(first);
  });
});
