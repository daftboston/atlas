import { eq, inArray, notInArray } from 'drizzle-orm';

import type { BlockedAppState } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { blockedApps, practiceSessions } from '../schema';

export type BlockedAppRow = {
  appId: string;
  state: BlockedAppState;
  sessionId: string | null;
  updatedAt: number;
  /** Status of `sessionId`'s practice session, or null when there is none. */
  sessionStatus: 'active' | 'completed' | 'abandoned' | null;
};

export type BlockedAppsRepository = ReturnType<typeof createBlockedAppsRepo>;

/** Which apps the learner chose to block, and the saved lock state of each (the blocking demo). */
export function createBlockedAppsRepo(db: AtlasDatabase) {
  function sessionStatus(sessionId: string | null): BlockedAppRow['sessionStatus'] {
    if (!sessionId) return null;
    const row = db.select({ status: practiceSessions.status }).from(practiceSessions).where(eq(practiceSessions.id, sessionId)).get();
    return (row?.status as BlockedAppRow['sessionStatus']) ?? null;
  }

  return {
    list(): BlockedAppRow[] {
      return db
        .select()
        .from(blockedApps)
        .all()
        .map((row) => ({ ...row, sessionStatus: sessionStatus(row.sessionId) }));
    },

    /** Makes the chosen apps exactly the blocked set. New apps start locked; apps already chosen keep their state. */
    select(appIds: string[], now: number) {
      db.transaction((tx) => {
        if (appIds.length === 0) tx.delete(blockedApps).run();
        else tx.delete(blockedApps).where(notInArray(blockedApps.appId, appIds)).run();
        const existing = new Set(
          appIds.length === 0 ? [] : tx.select({ id: blockedApps.appId }).from(blockedApps).where(inArray(blockedApps.appId, appIds)).all().map((row) => row.id),
        );
        for (const appId of appIds) {
          if (!existing.has(appId)) tx.insert(blockedApps).values({ appId, state: 'locked', sessionId: null, updatedAt: now }).run();
        }
      });
    },

    save(appId: string, state: BlockedAppState, sessionId: string | null, now: number) {
      db.update(blockedApps).set({ state, sessionId, updatedAt: now }).where(eq(blockedApps.appId, appId)).run();
    },
  };
}
