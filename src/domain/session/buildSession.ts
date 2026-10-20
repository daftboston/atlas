import { DUE_BACKLOG_LIMIT } from '@/domain/config';
import { localDayStartMs } from '@/lib/time';

import type { KnowledgeItemStatus, PromptType, SessionMode } from '@/domain/types';

/** One step in a session. Recall for a new item comes after its listen step. */
export type SessionStep = {
  itemId: string;
  promptType: PromptType;
};

export type SessionCandidate = {
  id: string;
  seedId: string | null;
  status: KnowledgeItemStatus;
  introducedAt: number | null;
};

export type SessionPlan = {
  mode: SessionMode;
  itemIds: string[];
  steps: SessionStep[];
};

/** A card that is already due. Lower retrievability is more at risk. */
export type DueCandidate = {
  itemId: string;
  retrievability: number;
};

export type BuildSessionInput = {
  now: number;
  timeZone: string;
  mode: SessionMode;
  dailyNewLimit: number;
  sessionSize: number;
  onboardingItemCount: number;
  items: readonly SessionCandidate[];
  due: readonly DueCandidate[];
};

/**
 * Due reviews first, then new items in the slots that remain.
 * Returns null when there is nothing to practice, so the caller creates no session.
 */
export function buildSession(input: BuildSessionInput): SessionPlan | null {
  const picked = pickItems(input);
  const itemIds = [...picked.reviewIds, ...picked.newIds];
  if (itemIds.length === 0) return null;
  const steps = [
    ...picked.reviewIds.map((itemId) => ({ itemId, promptType: 'recall-speak' as const })),
    ...interleaveNewItems(picked.newIds),
  ];
  return { mode: input.mode, itemIds, steps };
}

/** Steps saved on the session. Older rows stored only item ids and were all new. */
export function sessionSteps(
  plannedItemIds: readonly string[],
  plannedSteps: readonly SessionStep[] | null,
): SessionStep[] {
  if (plannedSteps && plannedSteps.length > 0) return [...plannedSteps];
  return interleaveNewItems(plannedItemIds);
}

/** New items still available today, before the session-size cap. */
export function dailyNewRemaining(input: BuildSessionInput): number {
  if (input.mode !== 'daily') return 0;
  const dayStart = localDayStartMs(input.now, input.timeZone);
  const introducedToday = input.items.filter(
    (item) => item.introducedAt !== null && item.introducedAt >= dayStart,
  ).length;
  const available = eligibleNew(input.items).length;
  return Math.min(available, Math.max(0, input.dailyNewLimit - introducedToday));
}

/**
 * Listen steps first, then each item's recall. With two or more items the recall
 * is at least two steps after its listen. A single item has nothing to put between them.
 */
export function interleaveNewItems(itemIds: readonly string[]): SessionStep[] {
  return [
    ...itemIds.map((itemId) => ({ itemId, promptType: 'listen-repeat' as const })),
    ...itemIds.map((itemId) => ({ itemId, promptType: 'recall-speak' as const })),
  ];
}

function pickItems(input: BuildSessionInput): { reviewIds: string[]; newIds: string[] } {
  if (input.mode === 'onboarding') {
    return { reviewIds: [], newIds: takeNew(input, input.onboardingItemCount) };
  }
  const reviewIds = [...input.due]
    .sort((a, b) => {
      if (a.retrievability !== b.retrievability) return a.retrievability - b.retrievability;
      if (a.itemId === b.itemId) return 0;
      return a.itemId < b.itemId ? -1 : 1;
    })
    .slice(0, input.sessionSize)
    .map((card) => card.itemId);
  if (input.mode === 'review-only') return { reviewIds, newIds: [] };
  const slots = Math.max(0, input.sessionSize - reviewIds.length);
  const budget = input.due.length > DUE_BACKLOG_LIMIT ? 0 : Math.min(slots, dailyNewRemaining(input));
  const taken = new Set(reviewIds);
  return { reviewIds, newIds: takeNew(input, budget).filter((id) => !taken.has(id)) };
}

function takeNew(input: BuildSessionInput, budget: number): string[] {
  if (budget <= 0) return [];
  return eligibleNew(input.items).slice(0, budget).map((item) => item.id);
}

function eligibleNew(items: readonly SessionCandidate[]): SessionCandidate[] {
  return items
    .filter((item) => item.status === 'new' && item.introducedAt === null)
    .slice()
    .sort((a, b) => compareSeed(a.seedId, b.seedId));
}

function compareSeed(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
