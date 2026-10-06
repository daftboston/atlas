import { useSyncExternalStore } from 'react';

import type { LearnerRepository } from '@/data/repositories/learnerRepo';
import type { LearnerProfile, LessonWord, SavedWord } from '@/domain/types';

// Mirrors what the UI needs from SQLite (the source of truth, architecture §4).
// Every action writes through the repository first, then publishes what it returned.
// Zustand is the target for src/state (§2) but isn't an approved dependency yet, so this
// keeps the useSyncExternalStore store the app already had.

export type LearnerSnapshot = {
  /** False until the store has loaded from the repository. */
  ready: boolean;
  profile: LearnerProfile | null;
  /** Newest first. */
  words: SavedWord[];
};

let repository: LearnerRepository | null = null;
let snapshot: LearnerSnapshot = { ready: false, profile: null, words: [] };
const listeners = new Set<() => void>();

function publish(next: Partial<LearnerSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function repo(): LearnerRepository {
  if (!repository) throw new Error('Learner store used before hydrateLearner()');
  return repository;
}

async function run(action: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    // Nothing was published, so the UI keeps showing what is actually stored.
    console.error(`[learnerStore] ${action} failed`, error);
  }
}

export function getLearnerSnapshot() {
  return snapshot;
}

export function useLearner() {
  return useSyncExternalStore(subscribe, getLearnerSnapshot, getLearnerSnapshot);
}

/** Loads the profile and saved words from persistence. Call once at startup (and per test). */
export async function hydrateLearner(next: LearnerRepository) {
  repository = next;
  const [profile, words] = await Promise.all([next.getProfile(), next.listSavedWords()]);
  publish({ ready: true, profile, words });
}

export function startCourse(courseId: string) {
  return run('startCourse', async () => {
    publish({ profile: await repo().startCourse(courseId) });
  });
}

export function clearProfile() {
  return run('clearProfile', async () => {
    await repo().clearProfile();
    publish({ profile: null });
  });
}

/** Idempotent: saving the same lesson word twice keeps one saved word. */
export function saveWord(word: LessonWord, savedAtMs = Date.now()) {
  return run('saveWord', async () => {
    await repo().saveWord(word, savedAtMs);
    publish({ words: await repo().listSavedWords() });
  });
}
