import { eq } from 'drizzle-orm';

import { suspendItem, unsuspendItem } from '@/domain/memory/suspend';
import type { KnowledgeItem } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { knowledgeItems } from '../schema';

/** learning-loop §3.1 */
export function createKnowledgeRepo(db: AtlasDatabase) {
  function apply(id: string, now: number, change: typeof suspendItem) {
    const row = db.select().from(knowledgeItems).where(eq(knowledgeItems.id, id)).get();
    if (!row) return;
    const next = change({ status: row.status, statusBeforeSuspend: row.statusBeforeSuspend });
    if (next.status === row.status && next.statusBeforeSuspend === row.statusBeforeSuspend) return;
    db.update(knowledgeItems)
      .set({ status: next.status, statusBeforeSuspend: next.statusBeforeSuspend, updatedAt: now })
      .where(eq(knowledgeItems.id, id))
      .run();
  }

  return {
    getBySeedId(seedId: string): KnowledgeItem | null {
      return db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, seedId)).get() ?? null;
    },
    listByCourse(courseId: string): KnowledgeItem[] {
      return db.select().from(knowledgeItems).where(eq(knowledgeItems.courseId, courseId)).all();
    },
    suspend(id: string, now: number) {
      apply(id, now, suspendItem);
    },
    unsuspend(id: string, now: number) {
      apply(id, now, unsuspendItem);
    },
  };
}
