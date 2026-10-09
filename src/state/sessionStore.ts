import { useSyncExternalStore } from 'react';

import type { PracticeView, RecordAttemptInput, SessionHome, SessionRepository, StartResult } from '@/data/repositories/sessionRepo';
import { deviceTimeZone } from '@/lib/time';

import { refreshReview } from './reviewStore';
import { refreshUnlock } from './unlockStore';

export type SessionSnapshot = {
  ready: boolean;
  home: SessionHome;
};

const EMPTY_HOME: SessionHome = { activeSessionId: null, newRemaining: 0, dueCount: 0, caughtUp: false };

let repository: SessionRepository | null = null;
let snapshot: SessionSnapshot = { ready: false, home: EMPTY_HOME };
const listeners = new Set<() => void>();

function publish(next: SessionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function repo(): SessionRepository {
  if (!repository) throw new Error('Session store used before hydrateSession()');
  return repository;
}

function refresh(now = Date.now()) {
  if (!repository) return;
  publish({ ready: true, home: repository.home(now, deviceTimeZone()) });
  refreshReview(now);
}

export function hydrateSession(next: SessionRepository, now = Date.now()) {
  repository = next;
  refresh(now);
}

export function resetSession() {
  repository = null;
  publish({ ready: false, home: EMPTY_HOME });
}

export function useSessionHome(): SessionSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function startDailySession(now = Date.now()): StartResult {
  const result = repo().start('daily', now, deviceTimeZone());
  refresh(now);
  return result;
}

export function startReviewSession(now = Date.now()): StartResult {
  const result = repo().start('review-only', now, deviceTimeZone());
  refresh(now);
  return result;
}

export function startOnboardingSession(now = Date.now()): StartResult {
  const result = repo().start('onboarding', now, deviceTimeZone());
  refresh(now);
  return result;
}

/** Read a session without publishing. Safe to call while drawing a screen. */
export function readPractice(sessionId: string): PracticeView | null {
  if (!repository) return null;
  return repository.getPractice(sessionId);
}

/** Resume entry. Abandons a stale session. Does not publish; callers refresh after paint. */
export function openPractice(sessionId: string, now = Date.now()): PracticeView | null {
  if (!repository) return null;
  return repository.touch(sessionId, now);
}

export function refreshSessionHome(now = Date.now()) {
  refresh(now);
}

export function saveAttempt(input: RecordAttemptInput) {
  repo().recordAttempt(input);
  refresh();
}

export function advanceSession(sessionId: string, now = Date.now()) {
  const status = repo().advance(sessionId, now, deviceTimeZone());
  refresh(now);
  if (status === 'completed') void refreshUnlock(now);
  return status;
}

export function abandonSession(sessionId: string, now = Date.now()) {
  repo().abandon(sessionId, now);
  refresh(now);
}
