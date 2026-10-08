import { MASTERED_MAX_LAPSES, MASTERED_STABILITY_DAYS } from '@/domain/config';
import type { FsrsRating, FsrsStateName, KnowledgeItemStatus } from '@/domain/types';

/** learning-loop §8.2. The item must already be in `review` after this grade. */
export function shouldMaster(input: {
  status: KnowledgeItemStatus;
  stabilityDays: number;
  lapses: number;
  rating: FsrsRating;
}): boolean {
  return (
    input.status === 'review' &&
    input.stabilityDays >= MASTERED_STABILITY_DAYS &&
    input.rating >= 3 &&
    input.lapses <= MASTERED_MAX_LAPSES
  );
}

/**
 * Knowledge-item status after one graded review.
 * `masteredAt` stays in place when Again sends a mastered item back to relearning.
 */
export function itemStatusAfterGrade(input: {
  status: KnowledgeItemStatus;
  fsrsState: FsrsStateName;
  rating: FsrsRating;
  stabilityDays: number;
  lapses: number;
}): KnowledgeItemStatus {
  if (input.status === 'suspended') return 'suspended';
  if (input.rating === 1 && (input.status === 'review' || input.status === 'mastered')) return 'relearning';
  if (input.status === 'mastered' && input.rating >= 3 && input.fsrsState === 'Review') return 'mastered';

  let status: KnowledgeItemStatus;
  if (input.status === 'new') {
    status = input.fsrsState === 'Review' ? 'review' : 'learning';
  } else if (input.fsrsState === 'Review') {
    status = 'review';
  } else if (input.fsrsState === 'Relearning') {
    status = 'relearning';
  } else if (input.fsrsState === 'Learning') {
    status = input.status === 'relearning' ? 'relearning' : 'learning';
  } else {
    status = input.status;
  }

  if (shouldMaster({ status, stabilityDays: input.stabilityDays, lapses: input.lapses, rating: input.rating })) {
    return 'mastered';
  }
  return status;
}
