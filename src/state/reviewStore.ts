import { useSyncExternalStore } from 'react';

import type { ReviewHome, ReviewRepository } from '@/data/repositories/reviewRepo';

export type ReviewSnapshot = {
  ready: boolean;
  now: number;
  home: ReviewHome;
};

const EMPTY_HOME: ReviewHome = { masteredCount: 0, due: [], upcoming: [], saved: [] };

let repository: ReviewRepository | null = null;
let snapshot: ReviewSnapshot = { ready: false, now: 0, home: EMPTY_HOME };
const listeners = new Set<() => void>();

function publish(next: ReviewSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateReview(next: ReviewRepository, now = Date.now()) {
  repository = next;
  refreshReview(now);
}

export function resetReview() {
  repository = null;
  publish({ ready: false, now: 0, home: EMPTY_HOME });
}

export function refreshReview(now = Date.now()) {
  if (!repository) return;
  publish({ ready: true, now, home: repository.home(now) });
}

export function useReviewHome(): ReviewSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
