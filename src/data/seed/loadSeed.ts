import { eq, sql } from 'drizzle-orm';

import { newId } from '@/lib/id';

import type { AtlasDatabase } from '../client';
import { courses, knowledgeItems } from '../schema';
import type { CourseConfig } from './courses';
import { parseSeed } from './seedSchema';

export type SeedResult = { courseId: string; itemsInserted: number; itemsUpdated: number };

// A column is "changed" when the incoming (excluded) value differs, NULL-safe.
const changed = (column: string) => sql.raw(`"${column}" IS NOT excluded."${column}"`);

/**
 * Loads a course and its seed items (learning-loop §11). Idempotent, keyed by
 * `courses.id` and `knowledge_items.seed_id`: running it again creates nothing new.
 * Edits to an existing seedId update content columns only. Scheduling and progress
 * columns (status, status_before_suspend, introduced_at, mastered_at, created_at) are
 * never touched, and neither is the learner's chosen `speech_locale`.
 */
export function loadSeed(db: AtlasDatabase, config: CourseConfig, now: number): SeedResult {
  const seed = parseSeed(config.seed);

  return db.transaction((tx) => {
    tx.insert(courses)
      .values({
        id: seed.courseId,
        sourceLang: seed.sourceLang,
        targetLang: seed.targetLang,
        speechLocale: seed.defaultSpeechLocale,
        speechLocales: seed.speechLocales,
        title: config.title,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          sourceLang: seed.sourceLang,
          targetLang: seed.targetLang,
          speechLocales: seed.speechLocales,
          title: config.title,
        },
      })
      .run();

    const existing = new Set(
      tx
        .select({ seedId: knowledgeItems.seedId })
        .from(knowledgeItems)
        .where(eq(knowledgeItems.courseId, seed.courseId))
        .all()
        .map((row) => row.seedId),
    );

    let itemsInserted = 0;
    let itemsUpdated = 0;
    for (const item of seed.items) {
      const content = {
        kind: item.kind,
        targetText: item.target,
        meaning: item.prompt,
        reading: item.reading ?? null,
        romanization: item.romanization ?? null,
        variants: item.variants,
        level: item.level,
        topic: item.topic,
        notes: item.notes ?? null,
      };
      // RETURNING yields a row only when the item was inserted or its content changed.
      const written = tx
        .insert(knowledgeItems)
        .values({
          id: newId(),
          seedId: item.seedId,
          courseId: seed.courseId,
          ...content,
          tags: [],
          status: 'new',
          statusBeforeSuspend: null,
          createdAt: now,
          introducedAt: null,
          masteredAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: knowledgeItems.seedId,
          set: { ...content, updatedAt: now },
          setWhere: sql.join(
            [
              'kind',
              'target_text',
              'meaning',
              'reading',
              'romanization',
              'variants',
              'level',
              'topic',
              'notes',
            ].map(changed),
            sql` OR `,
          ),
        })
        .returning({ id: knowledgeItems.id })
        .all();

      if (written.length === 0) continue;
      if (existing.has(item.seedId)) itemsUpdated += 1;
      else itemsInserted += 1;
    }
    return { courseId: seed.courseId, itemsInserted, itemsUpdated };
  });
}
