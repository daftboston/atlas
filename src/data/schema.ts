// Drizzle tables for learning-loop §3. Only the tables the app uses today exist.
// review_queue, review_logs, and unlock_grants arrive with the scheduler and unlocks.
// Conventions (§3): UUID text ids, integer ms (UTC) timestamps, text enums with CHECK.
// Text primary keys are declared NOT NULL explicitly: SQLite otherwise lets a
// non-INTEGER primary key hold NULL. drizzle-kit 0.31 emits NOT NULL for primary keys
// on its own, but 1.0 RCs don't, so the schema states it rather than relying on the kit.
import { sql, type SQL } from 'drizzle-orm';
import { check, integer, real, sqliteTable, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

import type { WordScore } from '@/domain/scoring/types';
import {
  ATTEMPT_STATUSES,
  CEFR_LEVELS,
  INPUT_MODES,
  ITEM_KINDS,
  KNOWLEDGE_ITEM_STATUSES,
  PROMPT_TYPES,
  SAVED_WORD_DIFFICULTIES,
  SAVED_WORD_STATUSES,
  SESSION_MODES,
  SESSION_STATUSES,
} from '@/domain/types';

function oneOf(column: AnySQLiteColumn, values: readonly string[]): SQL {
  // Values are compile-time constants from domain/types.ts, never user input.
  return sql`${column} IN (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`;
}

/** §3.0 Course */
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey().notNull(),
  sourceLang: text('source_lang').notNull(),
  targetLang: text('target_lang').notNull(),
  speechLocale: text('speech_locale').notNull(),
  speechLocales: text('speech_locales', { mode: 'json' }).$type<string[]>().notNull(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** §3.1 KnowledgeItem */
export const knowledgeItems = sqliteTable(
  'knowledge_items',
  {
    id: text('id').primaryKey().notNull(),
    seedId: text('seed_id').unique(),
    kind: text('kind', { enum: ITEM_KINDS }).notNull(),
    targetText: text('target_text').notNull(),
    meaning: text('meaning').notNull(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    reading: text('reading'),
    romanization: text('romanization'),
    variants: text('variants', { mode: 'json' }).$type<string[]>().notNull(),
    level: text('level', { enum: CEFR_LEVELS }).notNull(),
    topic: text('topic').notNull(),
    notes: text('notes'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
    status: text('status', { enum: KNOWLEDGE_ITEM_STATUSES }).notNull(),
    statusBeforeSuspend: text('status_before_suspend', { enum: KNOWLEDGE_ITEM_STATUSES }),
    createdAt: integer('created_at').notNull(),
    introducedAt: integer('introduced_at'),
    masteredAt: integer('mastered_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    check('knowledge_items_kind_check', oneOf(t.kind, ITEM_KINDS)),
    check('knowledge_items_level_check', oneOf(t.level, CEFR_LEVELS)),
    check('knowledge_items_status_check', oneOf(t.status, KNOWLEDGE_ITEM_STATUSES)),
    check(
      'knowledge_items_status_before_suspend_check',
      sql`${t.statusBeforeSuspend} IS NULL OR ${oneOf(t.statusBeforeSuspend, KNOWLEDGE_ITEM_STATUSES)}`,
    ),
  ],
);

/** §3.8 Settings, key/value. Values are JSON-encoded. */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
});

/**
 * Not in learning-loop §3. Carries the saved-word fields that have no KnowledgeItem
 * column (example, lesson, difficulty, ready-to-review status, score, saved time), so
 * nothing the app recorded before persistence is dropped (ATLAS.md, next work #1).
 * One row per saved item, keyed by the item id.
 */
export const savedWords = sqliteTable(
  'saved_words',
  {
    itemId: text('item_id')
      .primaryKey()
      .notNull()
      .references(() => knowledgeItems.id, { onDelete: 'cascade' }),
    example: text('example').notNull(),
    lessonId: text('lesson_id').notNull(),
    difficulty: text('difficulty', { enum: SAVED_WORD_DIFFICULTIES }).notNull(),
    status: text('status', { enum: SAVED_WORD_STATUSES }).notNull(),
    score: real('score'),
    savedAt: integer('saved_at').notNull(),
  },
  (t) => [
    check('saved_words_difficulty_check', oneOf(t.difficulty, SAVED_WORD_DIFFICULTIES)),
    check('saved_words_status_check', oneOf(t.status, SAVED_WORD_STATUSES)),
  ],
);

/** learning-loop §3.4 */
export const practiceSessions = sqliteTable(
  'practice_sessions',
  {
    id: text('id').primaryKey().notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    mode: text('mode', { enum: SESSION_MODES }).notNull(),
    status: text('status', { enum: SESSION_STATUSES }).notNull(),
    plannedItemIds: text('planned_item_ids', { mode: 'json' }).$type<string[]>().notNull(),
    cursor: integer('cursor').notNull(),
  },
  (t) => [
    check('practice_sessions_mode_check', oneOf(t.mode, SESSION_MODES)),
    check('practice_sessions_status_check', oneOf(t.status, SESSION_STATUSES)),
  ],
);

/** learning-loop §3.5 */
export const practiceAttempts = sqliteTable(
  'practice_attempts',
  {
    id: text('id').primaryKey().notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => practiceSessions.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => knowledgeItems.id),
    promptType: text('prompt_type', { enum: PROMPT_TYPES }).notNull(),
    inputMode: text('input_mode', { enum: INPUT_MODES }).notNull(),
    tryNumber: integer('try_number').notNull(),
    status: text('status', { enum: ATTEMPT_STATUSES }).notNull(),
    transcript: text('transcript'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    graded: integer('graded', { mode: 'boolean' }).notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
  },
  (t) => [
    check('practice_attempts_prompt_type_check', oneOf(t.promptType, PROMPT_TYPES)),
    check('practice_attempts_input_mode_check', oneOf(t.inputMode, INPUT_MODES)),
    check('practice_attempts_status_check', oneOf(t.status, ATTEMPT_STATUSES)),
  ],
);

/** learning-loop §3.6. One row per scored attempt. */
export const feedback = sqliteTable(
  'feedback',
  {
    id: text('id').primaryKey().notNull(),
    attemptId: text('attempt_id')
      .notNull()
      .unique()
      .references(() => practiceAttempts.id, { onDelete: 'cascade' }),
    overall: real('overall').notNull(),
    accuracy: real('accuracy').notNull(),
    pronunciation: real('pronunciation'),
    wordsJson: text('words_json', { mode: 'json' }).$type<WordScore[]>().notNull(),
    method: text('method').notNull(),
    matchedText: text('matched_text').notNull(),
    accentHintsJson: text('accent_hints_json', { mode: 'json' }).$type<string[]>().notNull(),
    rating: integer('rating'),
    hintKey: text('hint_key'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [check('feedback_method_check', sql`${t.method} = 'text-match'`)],
);
