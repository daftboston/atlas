import { useSyncExternalStore } from 'react';

import type { BlockedAppsRepository } from '@/data/repositories/blockedAppsRepo';
import type { UnlockRepository } from '@/data/repositories/unlockRepo';
import { DEMO_APPS, type DemoApp } from '@/domain/blocking/apps';
import { reconcileLock, startPractice } from '@/domain/blocking/lockMachine';
import type { BlockedAppState } from '@/domain/types';
import { isBlockingDemoEnabled } from '@/services/screenTime/demo';
import { getScreenTimeService, setScreenTimeSimulation } from '@/services/screenTime/stub';

import { startDailySession } from './sessionStore';
import { activateGrant, refreshUnlock } from './unlockStore';

export type BlockedAppView = DemoApp & {
  state: BlockedAppState;
  /** The practice session last started from this app. */
  sessionId: string | null;
  /** When the active unlock runs out, while the app is unlocked. */
  unlockedUntil: number | null;
};

export type BlockingSnapshot = {
  ready: boolean;
  apps: BlockedAppView[];
  now: number;
};

type Repositories = { blocked: BlockedAppsRepository; unlock: UnlockRepository };

let repos: Repositories | null = null;
let snapshot: BlockingSnapshot = { ready: false, apps: [], now: 0 };
const listeners = new Set<() => void>();

function publish(next: BlockingSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function liveGrantExpiry(now: number): number | null {
  if (!repos) return null;
  const live = repos.unlock.list().filter((grant) => grant.status === 'active' && grant.expiresAt !== null && grant.expiresAt > now);
  return live.length > 0 ? Math.max(...live.map((grant) => grant.expiresAt as number)) : null;
}

/** Re-reads the saved lock states, applies the state machine, and saves what changed. */
function recompute(now: number) {
  if (!repos) return;
  const expiresAt = liveGrantExpiry(now);
  const apps: BlockedAppView[] = [];
  for (const row of repos.blocked.list()) {
    const known = DEMO_APPS.find((app) => app.id === row.appId);
    if (!known) continue;
    const next = reconcileLock({ state: row.state, sessionId: row.sessionId }, { now, activeGrantExpiresAt: expiresAt, sessionStatus: row.sessionStatus });
    if (next.state !== row.state) repos.blocked.save(row.appId, next.state, next.sessionId, now);
    apps.push({ ...known, state: next.state, sessionId: next.sessionId, unlockedUntil: next.state === 'unlocked' ? expiresAt : null });
  }
  const order = (id: string) => DEMO_APPS.findIndex((app) => app.id === id);
  apps.sort((a, b) => order(a.id) - order(b.id));
  publish({ ready: true, apps, now });
}

async function applyShield(ids: string[]) {
  try {
    await getScreenTimeService().applyShield({ token: 'demo', appCount: ids.length, categoryCount: 0, appIds: ids });
  } catch {
    // The stub does not fail. A real service may, and the saved choice is still right.
  }
}

export function hydrateBlocking(next: Repositories, now = Date.now()) {
  repos = next;
  // The demo needs a Screen Time that says yes, so the unlock flow lifts the shield as it would on a device.
  if (isBlockingDemoEnabled()) setScreenTimeSimulation(true);
  recompute(now);
  void applyShield(next.blocked.list().map((row) => row.appId));
}

export function resetBlocking() {
  repos = null;
  publish({ ready: false, apps: [], now: 0 });
}

export function useBlocking(): BlockingSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Unlock grants expire in the unlock store, so refresh it first, then read the lock states. */
export async function refreshBlocking(now = Date.now()) {
  if (!repos) return;
  await refreshUnlock(now);
  recompute(now);
}

export function setBlockedApps(ids: string[], now = Date.now()) {
  if (!repos) return;
  const chosen = DEMO_APPS.filter((app) => ids.includes(app.id)).map((app) => app.id);
  repos.blocked.select(chosen, now);
  recompute(now);
  void applyShield(chosen);
}

export type StartPracticeResult = { kind: 'started' | 'resumed'; sessionId: string } | { kind: 'unlocked' } | { kind: 'caught-up' } | { kind: 'missing' };

/** "Start practice" on the block screen: runs the existing daily session and remembers it for this app. */
export function startPracticeFor(appId: string, now = Date.now()): StartPracticeResult {
  if (!repos) return { kind: 'missing' };
  recompute(now);
  const app = snapshot.apps.find((candidate) => candidate.id === appId);
  if (!app) return { kind: 'missing' };
  if (app.state === 'unlocked') return { kind: 'unlocked' };
  if (app.state === 'practicing' && app.sessionId) {
    const row = repos.blocked.list().find((candidate) => candidate.appId === appId);
    if (row?.sessionStatus === 'active') return { kind: 'resumed', sessionId: app.sessionId };
  }
  const result = startDailySession(now);
  if (result.kind === 'caught-up') return { kind: 'caught-up' };
  const next = startPractice({ state: app.state, sessionId: app.sessionId }, result.id);
  repos.blocked.save(appId, next.state, next.sessionId, now);
  recompute(now);
  return { kind: result.kind, sessionId: result.id };
}

/**
 * A practice session finished. If it came from a blocked app and it earned a grant, the grant goes active now,
 * so the app shows as unlocked with a countdown. Without a grant the app stays locked.
 */
export async function completeBlockedSession(sessionId: string, now = Date.now()) {
  if (!repos) return;
  const tied = repos.blocked.list().some((row) => row.sessionId === sessionId && row.state !== 'unlocked');
  if (tied) {
    const grant = repos.unlock.forSession(sessionId);
    if (grant && grant.status === 'earned') await activateGrant(grant.id, now);
  }
  await refreshBlocking(now);
}

/** The blocked app a practice session was started from, if any. */
export function blockedAppForSession(sessionId: string): BlockedAppView | null {
  return snapshot.apps.find((app) => app.sessionId === sessionId) ?? null;
}
