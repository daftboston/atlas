/**
 * Tunable v0 numbers. Domain functions read these constants and take `now`
 * as an argument. They do not call `Date.now()`.
 * Grading cutoffs: learning-loop §4.1. Unlock and session numbers: §5 and §8.
 */

/** Overall below this is Again. */
export const RATING_AGAIN_BELOW = 50;

/** Overall below this is Hard. At or above it is at least Good. */
export const RATING_HARD_BELOW = 75;

/** Spoken recall on try 1 can be Easy at or above this. Applied in the scheduler, not the scorer. */
export const RATING_EASY_AT = 90;

/** learning-loop §5.2. One first try plus up to 2 retries per step. Failed (technical) attempts don't use a try. */
export const MAX_TRIES_PER_STEP = 3;

export const LISTEN_MAX_DURATION_MS = 8000;
export const LISTEN_SILENCE_TIMEOUT_MS = 1500;

export const DAILY_NEW_LIMIT = 5;
export const DAILY_NEW_LIMIT_MIN = 1;
export const DAILY_NEW_LIMIT_MAX = 20;
export const SESSION_SIZE = 8;
export const SESSION_SIZE_MIN = 1;
export const SESSION_SIZE_MAX = 20;
/** learning-loop §3.8. Choices offered for `desiredRetention`. */
export const RETENTION_CHOICES = [0.8, 0.85, 0.9, 0.95] as const;
export const ONBOARDING_ITEM_COUNT = 3;
export const SESSION_STALE_MS = 2 * 60 * 60 * 1000;

export const UNLOCK_BASE_MINUTES = 10;
export const UNLOCK_BONUS_MINUTES = 5;
export const UNLOCK_BONUS_OVERALL = 80;
export const UNLOCK_MAX_GRANT_MINUTES = 20;
export const UNLOCK_DAILY_CAP_MINUTES = 60;
export const UNLOCK_MIN_GRADED_ATTEMPTS = 5;
export const UNLOCK_ONBOARDING_MIN_GRADED_ATTEMPTS = 3;

export const MASTERED_STABILITY_DAYS = 60;
export const MASTERED_MAX_LAPSES = 3;

/** learning-loop §5.1. More due than this, and a daily session adds no new items. */
export const DUE_BACKLOG_LIMIT = 30;

/** Review tab window after now. Due items are listed separately. */
export const REVIEW_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/** learning-loop §3.8. FSRS `request_retention` when the setting is unset. */
export const DEFAULT_DESIRED_RETENTION = 0.9;
