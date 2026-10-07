import { eq } from 'drizzle-orm';

import type { KnowledgeItem } from '@/domain/types';

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
  };
}
