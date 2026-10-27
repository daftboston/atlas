import { eq } from 'drizzle-orm';

import { activeGrantExpired, grantActivatable, unusedGrantForfeited } from '@/domain/unlock/unlockRules';
import type { UnlockStatus } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { unlockGrants } from '../schema';

export type UnlockGrantRow = {
  id: string;
  sessionId: string;
  minutes: number;
  status: UnlockStatus;
  earnedAt: number;
  activatedAt: number | null;
  expiresAt: number | null;
  expiresUnusedAt: number;
  screenTimeApplied: boolean;
};

export type UnlockRepository = ReturnType<typeof createUnlockRepo>;

export function createUnlockRepo(db: AtlasDatabase) {
  function row(id: string): UnlockGrantRow | null {
    return db.select().from(unlockGrants).where(eq(unlockGrants.id, id)).get() ?? null;
  }

  return {
    list(): UnlockGrantRow[] {
      return db.select().from(unlockGrants).all().sort((a, b) => b.earnedAt - a.earnedAt);
    },

    forSession(sessionId: string): UnlockGrantRow | null {
      return db.select().from(unlockGrants).where(eq(unlockGrants.sessionId, sessionId)).get() ?? null;
    },

    /** Forfeit unused grants and expire active ones. Returns the grants that just expired. */
    reconcile(now: number): UnlockGrantRow[] {
      const expired: UnlockGrantRow[] = [];
      for (const grant of db.select().from(unlockGrants).all()) {
        if (grant.status === 'earned' && unusedGrantForfeited(grant.expiresUnusedAt, now)) {
          db.update(unlockGrants).set({ status: 'forfeited' }).where(eq(unlockGrants.id, grant.id)).run();
        }
        if (grant.status === 'active' && grant.expiresAt !== null && activeGrantExpired(grant.expiresAt, now)) {
          db.update(unlockGrants).set({ status: 'expired' }).where(eq(unlockGrants.id, grant.id)).run();
          expired.push({ ...grant, status: 'expired' });
        }
      }
      return expired;
    },

    /**
     * `earned` becomes `active`. The caller talks to Screen Time after this write.
     * Returns null, and writes nothing, for an unknown grant, one that is already active or used
     * (`active`, `expired`), or one past `expiresUnusedAt` (learning-loop §8: unused grants are
     * forfeited at the next rollover). A late grant is forfeited on the spot, so its status
     * doesn't wait for the next reconcile.
     */
    activate(id: string, now: number): UnlockGrantRow | null {
      const grant = row(id);
      if (!grant) return null;
      if (grant.status === 'earned' && unusedGrantForfeited(grant.expiresUnusedAt, now)) {
        db.update(unlockGrants).set({ status: 'forfeited' }).where(eq(unlockGrants.id, id)).run();
        return null;
      }
      if (!grantActivatable(grant, now)) return null;
      const expiresAt = now + grant.minutes * 60 * 1000;
      db.update(unlockGrants)
        .set({ status: 'active', activatedAt: now, expiresAt, screenTimeApplied: false })
        .where(eq(unlockGrants.id, id))
        .run();
      return row(id);
    },

    markApplied(id: string) {
      db.update(unlockGrants).set({ screenTimeApplied: true }).where(eq(unlockGrants.id, id)).run();
    },
  };
}
