import { eq } from 'drizzle-orm';

import type { KnowledgeItem, LessonWord } from '@/domain/types';
import { newId } from '@/lib/id';

import type { AtlasDatabase } from '../client';
import { knowledgeItems } from '../schema';

/** learning-loop §3.1 */
export function createKnowledgeRepo(db: AtlasDatabase) {
  return {
    getBySeedId(seedId: string): KnowledgeItem | null {
      return db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, seedId)).get() ?? null;
    },
    listByCourse(courseId: string): KnowledgeItem[] {
      return db.select().from(knowledgeItems).where(eq(knowledgeItems.courseId, courseId)).all();
    },
    /**
     * Returns the item for a lesson word, creating it (status `new`) the first time.
     * Keyed by `seed_id`, so calling it again never creates a duplicate.
     */
    ensureLessonWord(courseId: string, word: LessonWord, now: number): KnowledgeItem {
      db.insert(knowledgeItems)
        .values({
          id: newId(),
          seedId: word.contentId,
          kind: word.kind,
          targetText: word.text,
          meaning: word.meaning,
          courseId,
          reading: null,
          romanization: null,
          variants: [],
          level: word.level,
          topic: word.topic,
          notes: null,
          tags: [],
          status: 'new',
          statusBeforeSuspend: null,
          createdAt: now,
          introducedAt: null,
          masteredAt: null,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: knowledgeItems.seedId })
        .run();
      const item = this.getBySeedId(word.contentId);
      if (!item) throw new Error(`Knowledge item ${word.contentId} was not saved`);
      return item;
    },
  };
}
