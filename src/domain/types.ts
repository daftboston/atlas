// Shared domain types. They mirror the learning-loop §3 entities that exist so far.
// Pure TypeScript: no React, React Native, Expo, Drizzle or services imports.
import type { WordScore } from '@/domain/scoring/types';

/** BCP-47 language tag. Nothing in the domain is keyed on a specific language. */
export type LanguageCode = string;

/** learning-loop §3.0 */
export type Course = {
  id: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  speechLocale: string;
  speechLocales: string[];
  title: string;
  createdAt: number;
};

export const ITEM_KINDS = ['word', 'phrase', 'sentence'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const CEFR_LEVELS = ['A1', 'A2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** learning-loop §3.1.1 */
export const KNOWLEDGE_ITEM_STATUSES = [
  'new',
  'learning',
  'review',
  'relearning',
  'mastered',
  'suspended',
] as const;
export type KnowledgeItemStatus = (typeof KNOWLEDGE_ITEM_STATUSES)[number];

/** learning-loop §3.2. Names match the ts-fsrs `State` enum. */
export const FSRS_STATES = ['New', 'Learning', 'Review', 'Relearning'] as const;
export type FsrsStateName = (typeof FSRS_STATES)[number];

/** Again, Hard, Good, Easy. Manual (0) is not a grade. */
export type FsrsRating = 1 | 2 | 3 | 4;

/** learning-loop §3.1 */
export type KnowledgeItem = {
  id: string;
  seedId: string | null;
  kind: ItemKind;
  targetText: string;
  meaning: string;
  courseId: string;
  reading: string | null;
  romanization: string | null;
  variants: string[];
  level: CefrLevel;
  topic: string;
  notes: string | null;
  tags: string[];
  status: KnowledgeItemStatus;
  statusBeforeSuspend: KnowledgeItemStatus | null;
  createdAt: number;
  introducedAt: number | null;
  masteredAt: number | null;
  updatedAt: number;
};

/** learning-loop §3.8 (`app_settings`). Only the keys the app reads today are required to exist. */
export type AppSettings = {
  onboardingCompleted: boolean;
  uiLanguage: LanguageCode;
  activeCourseId: string;
  dailyNewLimit: number;
  sessionSize: number;
  desiredRetention: number;
  screenTimeEnabled: boolean;
  /** True when the learner chose to continue without the microphone. */
  micDenied: boolean;
};

/** The active course, as the current Learn and Settings screens see it. */
export type LearnerProfile = {
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

export const SAVED_WORD_DIFFICULTIES = ['intro'] as const;
export const SAVED_WORD_STATUSES = ['ready-to-review'] as const;

/**
 * A word the learner saved from a lesson. Saving means "ready to review", never "mastered".
 * Every field the in-memory store carried is kept. `id` is the KnowledgeItem id.
 */
export type SavedWord = {
  id: string;
  text: string;
  meaning: string;
  example: string;
  lessonId: string;
  language: LanguageCode;
  difficulty: (typeof SAVED_WORD_DIFFICULTIES)[number];
  status: (typeof SAVED_WORD_STATUSES)[number];
  score: null;
  /** ISO 8601. Stored as integer ms (UTC) in SQLite. */
  savedAt: string;
};

export const SESSION_MODES = ['onboarding', 'daily', 'review-only'] as const;

/** learning-loop §3.7. */
export const UNLOCK_STATUSES = ['earned', 'active', 'expired', 'forfeited'] as const;
export type UnlockStatus = (typeof UNLOCK_STATUSES)[number];
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PROMPT_TYPES = ['listen-repeat', 'recall-speak'] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

export const INPUT_MODES = ['speech', 'typed'] as const;
export type InputMode = (typeof INPUT_MODES)[number];

export const ATTEMPT_STATUSES = ['pending', 'captured', 'scored', 'failed', 'skipped'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** learning-loop §3.4. `plannedItemIds` stays in seed order. Steps are derived from it. */
export type PracticeSession = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  mode: SessionMode;
  status: SessionStatus;
  plannedItemIds: string[];
  /** Index of the next step. Steps are `interleaveNewItems(plannedItemIds)`. */
  cursor: number;
};

/** learning-loop §3.5 */
export type PracticeAttempt = {
  id: string;
  sessionId: string;
  itemId: string;
  promptType: PromptType;
  inputMode: InputMode;
  tryNumber: number;
  status: AttemptStatus;
  transcript: string | null;
  durationMs: number | null;
  error: string | null;
  /** True only for the attempt that updates the scheduler. Retries and technical failures stay false. */
  graded: boolean;
  startedAt: number;
  endedAt: number | null;
};

/** learning-loop §3.6. One row per scored attempt. */
export type AttemptFeedback = {
  id: string;
  attemptId: string;
  overall: number;
  accuracy: number;
  pronunciation: number | null;
  words: WordScore[];
  method: 'text-match';
  matchedText: string;
  accentHints: string[];
  rating: number | null;
  hint: string | null;
  createdAt: number;
};

/** Lesson content for a word the learner can save. */
export type LessonWord = {
  /**
   * The seed-deck item the lesson teaches (`knowledge_items.seed_id`, e.g. `es-v0-001`).
   * Saving looks the item up by this key, so saving twice is idempotent.
   */
  seedId: string;
  text: string;
  meaning: string;
  example: string;
  lessonId: string;
};
