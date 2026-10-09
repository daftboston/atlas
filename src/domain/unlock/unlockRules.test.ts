import { activeGrantExpired, decideUnlock, unusedGrantForfeited } from './unlockRules';

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