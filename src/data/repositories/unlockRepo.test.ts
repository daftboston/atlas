/** @jest-environment node */
import { eq } from 'drizzle-orm';

import type { AtlasDatabase } from '../client';
import { practiceSessions, unlockGrants } from '../schema';
import { openTestDatabase } from '../testDatabase';
import { createUnlockRepo } from './unlockRepo';

const NOW = Date.parse('2026-10-07T15:00:00.000Z');

describe('unlock repository', () => {
  let db: AtlasDatabase;

  beforeEach(async () => {
    db = await openTestDatabase();
    db.insert(practiceSessions)
      .values({
        id: 'session-1',
        startedAt: NOW,
        endedAt: NOW,
        mode: 'daily',
        status: 'completed',
        plannedItemIds: [],
        cursor: 1,
      })
      .run();
    db.insert(unlockGrants)
      .values({
        id: 'grant-1',
        sessionId: 'session-1',
        minutes: 10,
        status: 'earned',
        earnedAt: NOW,
        activatedAt: null,
        expiresAt: null,
        expiresUnusedAt: NOW + 60_000,
        screenTimeApplied: false,
      })
      .run();
  });

  it('forfeits an unused grant at its rollover', () => {
    const repo = createUnlockRepo(db);
    repo.reconcile(NOW + 60_000);
    expect(db.select().from(unlockGrants).all()[0]?.status).toBe('forfeited');
  });

  it('activates a grant and later expires it', () => {
    const repo = createUnlockRepo(db);
    const active = repo.activate('grant-1', NOW);
    expect(active).toMatchObject({ status: 'active', screenTimeApplied: false, expiresAt: NOW + 10 * 60 * 1000 });
    repo.markApplied('grant-1');
    const expired = repo.reconcile(NOW + 10 * 60 * 1000);
    expect(expired.map((grant) => grant.id)).toEqual(['grant-1']);
    expect(db.select().from(unlockGrants).where(eq(unlockGrants.id, 'grant-1')).get()?.status).toBe('expired');
  });
});
