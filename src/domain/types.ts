// Shared domain types. They mirror the learning-loop §3 entities that exist so far.
// Pure TypeScript: no React, React Native, Expo, Drizzle or services imports.

/** BCP-47 language tag, e.g. `en`, `es`. Nothing in the domain is keyed on a specific language. */
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

/** Lesson content for a word the learner can save. */
export type LessonWord = {
  /** Stable content key, stored in `knowledge_items.seed_id` so saving twice is idempotent. */
  contentId: string;
  kind: ItemKind;
  level: CefrLevel;
  topic: string;
  text: string;
  meaning: string;
  example: string;
  lessonId: string;
};
