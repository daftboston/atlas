import { and, count, eq, gt, isNull, lte, sql } from 'drizzle-orm';

import { REVIEW_HORIZON_MS } from '@/domain/config';

import type { AtlasDatabase } from '../client';
import { knowledgeItems, reviewQueue, savedWords } from '../schema';

export type ReviewEntry = {
  itemId: string;
  targetText: string;
  meaning: string;
  due: number | null;
};

export type ReviewHome = {
  masteredCount: number;
  due: ReviewEntry[];
  upcoming: ReviewEntry[];
  /** Saved words that do not have a card yet. The queue replaces them once a card exists. */
  saved: ReviewEntry[];
};

const openStatus = sql`${knowledgeItems.status} NOT IN ('new', 'suspended')`;

export type ReviewRepository = ReturnType<typeof createReviewRepo>;

export function createReviewRepo(db: AtlasDatabase) {
  function cards(where: ReturnType<typeof and> | ReturnType<typeof sql>) {
    return db
      .select({
        itemId: knowledgeItems.id,
        targetText: knowledgeItems.targetText,
        meaning: knowledgeItems.meaning,
        due: reviewQueue.due,
      })
      .from(reviewQueue)
      .innerJoin(knowledgeItems, eq(knowledgeItems.id, reviewQueue.itemId))
      .where(where)
      .orderBy(reviewQueue.due)
      .all();
  }

  return {
    home(now: number): ReviewHome {
      const mastered = db
        .select({ n: count() })
        .from(knowledgeItems)
        .where(eq(knowledgeItems.status, 'mastered'))
        .get();
      const saved = db
        .select({
          itemId: knowledgeItems.id,
          targetText: knowledgeItems.targetText,
          meaning: knowledgeItems.meaning,
        })
        .from(savedWords)
        .innerJoin(knowledgeItems, eq(knowledgeItems.id, savedWords.itemId))
        .leftJoin(reviewQueue, eq(reviewQueue.itemId, savedWords.itemId))
        .where(isNull(reviewQueue.itemId))
        .all()
        .map((row) => ({ ...row, due: null }));

      return {
        masteredCount: Number(mastered?.n ?? 0),
        due: cards(and(lte(reviewQueue.due, now), openStatus)),
        upcoming: cards(and(gt(reviewQueue.due, now), lte(reviewQueue.due, now + REVIEW_HORIZON_MS), openStatus)),
        saved,
      };
    },
  };
}
