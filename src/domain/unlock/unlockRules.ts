import {
  UNLOCK_BASE_MINUTES,
  UNLOCK_BONUS_MINUTES,
  UNLOCK_BONUS_OVERALL,
  UNLOCK_DAILY_CAP_MINUTES,
  UNLOCK_MAX_GRANT_MINUTES,
  UNLOCK_MIN_GRADED_ATTEMPTS,
  UNLOCK_ONBOARDING_MIN_GRADED_ATTEMPTS,
} from '@/domain/config';
import type { SessionMode, UnlockStatus } from '@/domain/types';
import { nextRolloverMs } from '@/lib/time';

export type UnlockDecision = { kind: 'grant'; minutes: number } | { kind: 'daily-limit' } | { kind: 'not-enough' };

/**
 * learning-loop §8.1. `gradedCount` excludes failed and skipped attempts.
 * `overalls` are the scores of the graded attempts that have one.
 */
export function decideUnlock(input: {
  mode: SessionMode;
  gradedCount: number;
  overalls: readonly number[];
  minutesAlreadyToday: number;
}): UnlockDecision {
  const needed = input.mode === 'onboarding' ? UNLOCK_ONBOARDING_MIN_GRADED_ATTEMPTS : UNLOCK_MIN_GRADED_ATTEMPTS;
  if (input.gradedCount < needed) return { kind: 'not-enough' };

  let minutes = UNLOCK_BASE_MINUTES;
  if (input.overalls.length > 0) {
    const mean = input.overalls.reduce((sum, overall) => sum + overall, 0) / input.overalls.length;
    if (mean >= UNLOCK_BONUS_OVERALL) minutes += UNLOCK_BONUS_MINUTES;
  }
  minutes = Math.min(minutes, UNLOCK_MAX_GRANT_MINUTES);
  const room = UNLOCK_DAILY_CAP_MINUTES - input.minutesAlreadyToday;
  if (room <= 0) return { kind: 'daily-limit' };
  return { kind: 'grant', minutes: Math.min(minutes, room) };
}

/** An earned grant is forfeited at the next 04:00, which is `expiresUnusedAt`. */
export function unusedGrantForfeited(expiresUnusedAt: number, now: number): boolean {
  return now >= expiresUnusedAt;
}

export function activeGrantExpired(expiresAt: number, now: number): boolean {
  return now >= expiresAt;
}

/** An earned grant can still be activated until its rollover. An active or used grant never can. */
export function grantActivatable(grant: { status: UnlockStatus; expiresUnusedAt: number }, now: number): boolean {
  return grant.status === 'earned' && !unusedGrantForfeited(grant.expiresUnusedAt, now);
}

/**
 * The next instant at which the unlock list can change by itself: an active grant ending,
 * an earned grant being forfeited, or the 04:00 local rollover. The Unlock tab schedules one
 * timeout for it instead of polling. Always later than `now`.
 */
export function nextUnlockChangeMs(
  grants: readonly { status: UnlockStatus; expiresAt: number | null; expiresUnusedAt: number }[],
  now: number,
  timeZone?: string,
): number {
  let next = nextRolloverMs(now, timeZone);
  for (const grant of grants) {
    if (grant.status === 'active' && grant.expiresAt !== null && grant.expiresAt > now) {
      next = Math.min(next, grant.expiresAt);
    }
    if (grant.status === 'earned' && grant.expiresUnusedAt > now) {
      next = Math.min(next, grant.expiresUnusedAt);
    }
  }
  return next;
}
