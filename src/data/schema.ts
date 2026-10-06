// Drizzle tables for learning-loop §3. Only the tables the app uses today exist;
// the rest (review_queue, review_logs, sessions, attempts, feedback, unlock_grants)
// arrive with the work that needs them.
// Conventions (§3): UUID text ids, integer ms (UTC) timestamps, text enums with CHECK.
import { sql, type SQL } from 'drizzle-orm';
import { check, integer, real, sqliteTable, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

import {
  CEFR_LEVELS,
  ITEM_KINDS,
  KNOWLEDGE_ITEM_STATUSES,
  SAVED_WORD_DIFFICULTIES,
  SAVED_WORD_STATUSES,
} from '@/domain/types';

function oneOf(column: AnySQLiteColumn, values: readonly string[]): SQL {
  // Values are compile-time constants from domain/types.ts, never user input.
  return sql`${column} IN (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`;
}

/** §3.0 Course */
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
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
    id: text('id').primaryKey(),
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
  key: text('key').primaryKey(),
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
