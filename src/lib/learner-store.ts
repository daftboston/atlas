import { useSyncExternalStore } from 'react';

import { wordId, type LanguageId, type SampleWord } from '@/content/sample-lesson';

export type LearnerProfile = {
  nativeLanguage: LanguageId;
  targetLanguage: LanguageId;
};

// Completion means the word is ready to review. It is not a mastery score.
export type SavedWord = SampleWord & {
  id: string;
  language: LanguageId;
  difficulty: 'intro';
  status: 'ready-to-review';
  score: null;
  savedAt: string;
};

type Snapshot = {
  profile: LearnerProfile | null;
  words: SavedWord[];
};

let profile: LearnerProfile | null = null;
let words: SavedWord[] = [];
let snapshot: Snapshot = { profile, words };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { profile, words };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLearnerSnapshot() {
  return snapshot;
}

export function useLearner() {
  return useSyncExternalStore(subscribe, getLearnerSnapshot, getLearnerSnapshot);
}

export function setProfile(next: LearnerProfile) {
  profile = next;
  publish();
}

export function clearProfile() {
  profile = null;
  publish();
}

export function saveWord(language: LanguageId, sample: SampleWord, savedAt = new Date().toISOString()) {
  const id = wordId(language, sample.text);
  const existing = words.find((word) => word.id === id);
  if (existing) return existing;

  const saved: SavedWord = {
    ...sample,
    id,
    language,
    difficulty: 'intro',
    status: 'ready-to-review',
    score: null,
    savedAt,
  };
  words = [saved, ...words];
  publish();
  return saved;
}

export function resetLearnerForTests() {
  profile = null;
  words = [];
  publish();
}
