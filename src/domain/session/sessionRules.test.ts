import { SESSION_STALE_MS } from '@/domain/config';

import { isSessionStale } from './sessionRules';

describe('isSessionStale', () => {
  const startedAt = 1_000_000;

  it('keeps a session that is exactly 2 hours old', () => {
    expect(isSessionStale(startedAt, startedAt + SESSION_STALE_MS)).toBe(false);
  });

  it('abandons a session one millisecond past 2 hours', () => {
    expect(isSessionStale(startedAt, startedAt + SESSION_STALE_MS + 1)).toBe(true);
  });
});
