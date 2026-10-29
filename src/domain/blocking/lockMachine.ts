import type { BlockedAppState } from '@/domain/types';

/**
 * Lock state machine for one blocked app (docs/architecture.md §7.1). Pure: no I/O, no clock.
 *
 *   locked | relocked --startPractice--> practicing --(grant goes active)--> unlocked --(grant expires)--> relocked
 *                                              |
 *                                              +--(session ends without an active grant)--> locked
 *
 * An unlock grant is the source of truth (Screen Time is downstream of it), so any live active grant unlocks
 * every blocked app, whether Atlas activated it after practice or the learner activated it on the Unlock tab.
 */
export type LockEntry = { state: BlockedAppState; sessionId: string | null };

export type LockContext = {
  now: number;
  /** `expiresAt` of the active grant that has not run out yet, or null. */
  activeGrantExpiresAt: number | null;
  /** Status of the practice session saved on the entry, or null when there is none. */
  sessionStatus: 'active' | 'completed' | 'abandoned' | null;
};

export function reconcileLock(entry: LockEntry, context: LockContext): LockEntry {
  if (context.activeGrantExpiresAt !== null && context.activeGrantExpiresAt > context.now) {
    return entry.state === 'unlocked' ? entry : { ...entry, state: 'unlocked' };
  }
  switch (entry.state) {
    case 'unlocked':
      // The grant that unlocked it has run out.
      return { ...entry, state: 'relocked' };
    case 'practicing':
      return context.sessionStatus === 'active' ? entry : { ...entry, state: 'locked' };
    default:
      return entry;
  }
}

/** Starts (or resumes) a practice session for a locked app. An unlocked or practicing app is unchanged. */
export function startPractice(entry: LockEntry, sessionId: string): LockEntry {
  if (entry.state === 'unlocked') return entry;
  return { state: 'practicing', sessionId };
}

export function lockLabel(state: BlockedAppState, remaining: string | null): string {
  switch (state) {
    case 'unlocked':
      return remaining ? `Unlocked, ${remaining} left` : 'Unlocked';
    case 'practicing':
      return 'Practice in progress';
    case 'relocked':
      return 'Locked again';
    default:
      return 'Locked';
  }
}

/** mm:ss for a countdown, rounded up so it never shows 00:00 while time is left. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
