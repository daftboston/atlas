import { activeGrantExpired, decideUnlock, grantActivatable, nextUnlockChangeMs, unusedGrantForfeited } from './unlockRules';

const five = [80, 80, 80, 80, 80];

describe('decideUnlock', () => {
  it('needs 5 graded attempts, or 3 during onboarding', () => {
    expect(decideUnlock({ mode: 'daily', gradedCount: 4, overalls: five.slice(0, 4), minutesAlreadyToday: 0 })).toEqual({
      kind: 'not-enough',
    });
    expect(decideUnlock({ mode: 'daily', gradedCount: 5, overalls: five, minutesAlreadyToday: 0 })).toEqual({
      kind: 'grant',
      minutes: 15,
    });
    expect(decideUnlock({ mode: 'onboarding', gradedCount: 2, overalls: [100, 100], minutesAlreadyToday: 0 })).toEqual({
      kind: 'not-enough',
    });
    expect(decideUnlock({ mode: 'onboarding', gradedCount: 3, overalls: [70, 70, 70], minutesAlreadyToday: 0 })).toEqual({
      kind: 'grant',
      minutes: 10,
    });
  });

  it('adds 5 minutes when the mean overall is at least 80', () => {
    expect(decideUnlock({ mode: 'daily', gradedCount: 5, overalls: [79, 79, 79, 79, 79], minutesAlreadyToday: 0 })).toEqual({
      kind: 'grant',
      minutes: 10,
    });
    expect(decideUnlock({ mode: 'daily', gradedCount: 5, overalls: [80, 80, 80, 80, 80], minutesAlreadyToday: 0 })).toEqual({
      kind: 'grant',
      minutes: 15,
    });
  });

  it('shrinks the grant to the minutes left today and stops at the daily cap', () => {
    expect(decideUnlock({ mode: 'daily', gradedCount: 5, overalls: five, minutesAlreadyToday: 50 })).toEqual({
      kind: 'grant',
      minutes: 10,
    });
    expect(decideUnlock({ mode: 'daily', gradedCount: 5, overalls: five, minutesAlreadyToday: 60 })).toEqual({
      kind: 'daily-limit',
    });
  });

  it('caps one grant at 20 minutes', () => {
    const decision = decideUnlock({ mode: 'daily', gradedCount: 5, overalls: five, minutesAlreadyToday: 0 });
    expect(decision.kind === 'grant' && decision.minutes <= 20).toBe(true);
  });

  it('forfeits an unused grant at rollover and expires an active one at its end', () => {
    expect(unusedGrantForfeited(1_000, 999)).toBe(false);
    expect(unusedGrantForfeited(1_000, 1_000)).toBe(true);
    expect(activeGrantExpired(5_000, 4_999)).toBe(false);
    expect(activeGrantExpired(5_000, 5_000)).toBe(true);
  });
});

describe('grantActivatable', () => {
  it('is true only for an earned grant before its rollover', () => {
    expect(grantActivatable({ status: 'earned', expiresUnusedAt: 1_000 }, 999)).toBe(true);
    expect(grantActivatable({ status: 'earned', expiresUnusedAt: 1_000 }, 1_000)).toBe(false);
    for (const status of ['active', 'expired', 'forfeited'] as const) {
      expect(grantActivatable({ status, expiresUnusedAt: 1_000 }, 0)).toBe(false);
    }
  });
});

describe('nextUnlockChangeMs', () => {
  const zone = 'UTC';
  const NOW = Date.parse('2026-10-07T15:00:00.000Z');
  const ROLLOVER = Date.parse('2026-10-08T04:00:00.000Z');

  it('is the 04:00 rollover when nothing else is pending', () => {
    expect(nextUnlockChangeMs([], NOW, zone)).toBe(ROLLOVER);
    expect(nextUnlockChangeMs([{ status: 'expired', expiresAt: NOW - 1, expiresUnusedAt: NOW - 5 }], NOW, zone)).toBe(ROLLOVER);
  });

  it('is the end of the soonest active grant', () => {
    const grants = [
      { status: 'active' as const, expiresAt: NOW + 600_000, expiresUnusedAt: ROLLOVER },
      { status: 'active' as const, expiresAt: NOW + 120_000, expiresUnusedAt: ROLLOVER },
    ];
    expect(nextUnlockChangeMs(grants, NOW, zone)).toBe(NOW + 120_000);
  });

  it('includes an earned grant forfeiting before the rollover, and ignores moments already past', () => {
    expect(nextUnlockChangeMs([{ status: 'earned', expiresAt: null, expiresUnusedAt: NOW + 5_000 }], NOW, zone)).toBe(NOW + 5_000);
    expect(nextUnlockChangeMs([{ status: 'earned', expiresAt: null, expiresUnusedAt: NOW }], NOW, zone)).toBe(ROLLOVER);
    expect(nextUnlockChangeMs([{ status: 'active', expiresAt: NOW, expiresUnusedAt: ROLLOVER }], NOW, zone)).toBe(ROLLOVER);
  });

  it('never picks a rollover later than the next 04:00 in the given zone', () => {
    // 03:59 in Bogota (UTC-5) is 08:59Z; the rollover is one minute away.
    const now = Date.parse('2026-10-07T08:59:00.000Z');
    expect(nextUnlockChangeMs([], now, 'America/Bogota')).toBe(now + 60_000);
  });
});
