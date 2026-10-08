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

export type BuildSessionInput = {
  now: number;
  timeZone: string;
  mode: SessionMode;
  dailyNewLimit: number;
  sessionSize: number;
  onboardingItemCount: number;
  items: readonly SessionCandidate[];
};

/**
 * New items only. Due reviews arrive with the scheduler.
 * Returns null when there is nothing to practice, so the caller creates no session.
 */
export function buildSession(input: BuildSessionInput): SessionPlan | null {
  const itemIds = pickNewItems(input);
  if (itemIds.length === 0) return null;
  return { mode: input.mode, itemIds, steps: interleaveNewItems(itemIds) };
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

function pickNewItems(input: BuildSessionInput): string[] {
  const budget = newBudget(input);
  if (budget <= 0) return [];
  return eligibleNew(input.items).slice(0, budget).map((item) => item.id);
}

function newBudget(input: BuildSessionInput): number {
  if (input.mode === 'review-only') return 0;
  if (input.mode === 'onboarding') return input.onboardingItemCount;
  return Math.min(input.sessionSize, dailyNewRemaining(input));
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
