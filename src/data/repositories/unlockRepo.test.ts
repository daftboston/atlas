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

  describe('activate rejections', () => {
    const grant = () => db.select().from(unlockGrants).where(eq(unlockGrants.id, 'grant-1')).get();

    it('still activates one millisecond before the rollover', () => {
      const active = createUnlockRepo(db).activate('grant-1', NOW + 59_999);
      expect(active).toMatchObject({ status: 'active', expiresAt: NOW + 59_999 + 10 * 60 * 1000 });
    });

    it.each([
      ['at its rollover', NOW + 60_000],
      ['after its rollover', NOW + 3_600_000],
    ])('rejects a grant past expiresUnusedAt (%s) and forfeits it', (_label, at) => {
      expect(createUnlockRepo(db).activate('grant-1', at)).toBeNull();
      expect(grant()).toMatchObject({ status: 'forfeited', activatedAt: null, expiresAt: null, screenTimeApplied: false });
    });

    it('rejects a grant that is already active, and does not restart its timer', () => {
      const repo = createUnlockRepo(db);
      const first = repo.activate('grant-1', NOW);
      expect(repo.activate('grant-1', NOW + 5 * 60 * 1000)).toBeNull();
      expect(grant()).toMatchObject({ status: 'active', activatedAt: NOW, expiresAt: first?.expiresAt });
    });

    it('rejects a grant that was already used (expired)', () => {
      const repo = createUnlockRepo(db);
      repo.activate('grant-1', NOW);
      repo.reconcile(NOW + 10 * 60 * 1000);
      expect(repo.activate('grant-1', NOW + 10 * 60 * 1000 + 1)).toBeNull();
      expect(grant()?.status).toBe('expired');
    });

    it('rejects a forfeited grant and an unknown id', () => {
      const repo = createUnlockRepo(db);
      repo.reconcile(NOW + 60_000);
      expect(repo.activate('grant-1', NOW + 60_001)).toBeNull();
      expect(grant()?.status).toBe('forfeited');
      expect(repo.activate('nope', NOW)).toBeNull();
    });
  });
});
