import { useSyncExternalStore } from 'react';

import type { UnlockGrantRow, UnlockRepository } from '@/data/repositories/unlockRepo';
import { getScreenTimeService } from '@/services/screenTime/stub';
import type { ScreenTimeAvailability } from '@/services/screenTime/types';

export type UnlockSnapshot = {
  ready: boolean;
  grants: UnlockGrantRow[];
  availability: ScreenTimeAvailability;
  now: number;
};

let repository: UnlockRepository | null = null;
let snapshot: UnlockSnapshot = { ready: false, grants: [], availability: 'unavailable', now: 0 };
const listeners = new Set<() => void>();

function publish(next: UnlockSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateUnlock(next: UnlockRepository, now = Date.now()) {
  repository = next;
  void refreshUnlock(now);
}

export function resetUnlock() {
  repository = null;
  publish({ ready: false, grants: [], availability: 'unavailable', now: 0 });
}

export async function refreshUnlock(now = Date.now()) {
  if (!repository) return;
  const screenTime = getScreenTimeService();
  const expired = repository.reconcile(now);
  if (expired.some((grant) => grant.screenTimeApplied)) {
    try {
      await screenTime.restoreShield();
    } catch {
      // The timer still ends. Screen Time is downstream of the grant.
    }
  }
  publish({
    ready: true,
    grants: repository.list(),
    availability: await screenTime.availability(),
    now,
  });
}

export async function activateGrant(id: string, now = Date.now()) {
  if (!repository) return;
  const grant = repository.activate(id, now);
  if (!grant || grant.expiresAt === null) {
    // Rejected (already used, or past its rollover): show the grant's real status.
    await refreshUnlock(now);
    return;
  }
  try {
    await getScreenTimeService().liftShield(grant.expiresAt);
    repository.markApplied(id);
  } catch {
    // Unavailable Screen Time still leaves the grant active.
  }
  await refreshUnlock(now);
}

export function useUnlock(): UnlockSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
