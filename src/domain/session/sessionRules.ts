import { SESSION_STALE_MS } from '@/domain/config';

/** An active session older than 2 hours is abandoned, never resumed (learning-loop §3.4). */
export function isSessionStale(startedAt: number, now: number): boolean {
  return now - startedAt > SESSION_STALE_MS;
}
