import { and, eq, gt } from 'drizzle-orm';

import { activeGrantExpired, unusedGrantForfeited } from '@/domain/unlock/unlockRules';
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
     * `earned` becomes `active`. The caller talks to Screen Time after this write. The check and the write are one
     * UPDATE, so a grant cannot be activated twice or after its rollover; returns null when nothing was updated.
     */
    activate(id: string, now: number): UnlockGrantRow | null {
      const grant = row(id);
      if (!grant) return null;
      const result = db
        .update(unlockGrants)
        .set({ status: 'active', activatedAt: now, expiresAt: now + grant.minutes * 60 * 1000, screenTimeApplied: false })
        .where(and(eq(unlockGrants.id, id), eq(unlockGrants.status, 'earned'), gt(unlockGrants.expiresUnusedAt, now)))
        .run();
      if (result.changes !== 1) return null;
      return row(id);
    },

    markApplied(id: string) {
      db.update(unlockGrants).set({ screenTimeApplied: true }).where(eq(unlockGrants.id, id)).run();
    },
  };
}
