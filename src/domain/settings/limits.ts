import {
  DAILY_NEW_LIMIT,
  DAILY_NEW_LIMIT_MAX,
  DAILY_NEW_LIMIT_MIN,
  DEFAULT_DESIRED_RETENTION,
  RETENTION_CHOICES,
  SESSION_SIZE,
  SESSION_SIZE_MAX,
  SESSION_SIZE_MIN,
} from '@/domain/config';

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Settings stepper bounds. Values outside the range snap to the nearest allowed one. */
export function clampDailyNewLimit(value: number): number {
  return clamp(value, DAILY_NEW_LIMIT_MIN, DAILY_NEW_LIMIT_MAX, DAILY_NEW_LIMIT);
}

export function clampSessionSize(value: number): number {
  return clamp(value, SESSION_SIZE_MIN, SESSION_SIZE_MAX, SESSION_SIZE);
}

/** Keeps retention on a choice the scheduler is tested with. */
export function normalizeRetention(value: number): number {
  const match = RETENTION_CHOICES.find((choice) => Math.abs(choice - value) < 0.001);
  return match ?? DEFAULT_DESIRED_RETENTION;
}
