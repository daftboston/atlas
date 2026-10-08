import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

import { DEFAULT_DESIRED_RETENTION } from '@/domain/config';
import type { FsrsRating, FsrsStateName } from '@/domain/types';

/** One FSRS card. Times are unix milliseconds. `learningSteps` is the ts-fsrs step index. */
export type QueueCard = {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: FsrsStateName;
  lastReviewAt: number | null;
};

/** The library log is the card as it was before this review. */
export type ReviewLogDraft = {
  rating: FsrsRating;
  stateBefore: FsrsStateName;
  dueBefore: number;
  stabilityBefore: number;
  difficultyBefore: number;
  elapsedDays: number;
  scheduledDays: number;
  reviewedAt: number;
};

const STATE_TO_NAME: Record<State, FsrsStateName> = {
  [State.New]: 'New',
  [State.Learning]: 'Learning',
  [State.Review]: 'Review',
  [State.Relearning]: 'Relearning',
};

const NAME_TO_STATE: Record<FsrsStateName, State> = {
  New: State.New,
  Learning: State.Learning,
  Review: State.Review,
  Relearning: State.Relearning,
};

const RATING_TO_GRADE: Record<FsrsRating, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

/**
 * Fuzz stays off. The same card, rating, and `now` then always schedule the same due time.
 * ts-fsrs 5.4.2 already defaults fuzz to off; this keeps that if a later pin turns it on.
 */
function scheduler(desiredRetention: number) {
  return fsrs({ request_retention: desiredRetention, enable_fuzz: false });
}

export function initCard(now: number): QueueCard {
  return fromLibraryCard(createEmptyCard(now));
}

export function schedule(
  card: QueueCard,
  rating: FsrsRating,
  now: number,
  desiredRetention = DEFAULT_DESIRED_RETENTION,
): { card: QueueCard; log: ReviewLogDraft } {
  const result = scheduler(desiredRetention).next(toLibraryCard(card), now, RATING_TO_GRADE[rating]);
  return {
    card: fromLibraryCard(result.card),
    log: {
      rating,
      stateBefore: STATE_TO_NAME[result.log.state],
      dueBefore: result.log.due.getTime(),
      stabilityBefore: result.log.stability,
      difficultyBefore: result.log.difficulty,
      elapsedDays: result.log.elapsed_days,
      scheduledDays: result.log.scheduled_days,
      reviewedAt: now,
    },
  };
}

export function retrievability(card: QueueCard, now: number, desiredRetention = DEFAULT_DESIRED_RETENTION): number {
  return scheduler(desiredRetention).get_retrievability(toLibraryCard(card), now, false);
}

function toLibraryCard(card: QueueCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: NAME_TO_STATE[card.state],
    last_review: card.lastReviewAt === null ? undefined : new Date(card.lastReviewAt),
  };
}

function fromLibraryCard(card: Card): QueueCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_NAME[card.state],
    lastReviewAt: card.last_review ? card.last_review.getTime() : null,
  };
}
