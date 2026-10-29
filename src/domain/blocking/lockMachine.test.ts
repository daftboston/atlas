/** @jest-environment node */
import { formatCountdown, lockLabel, reconcileLock, startPractice, type LockContext, type LockEntry } from './lockMachine';

const NOW = 1_000_000;
const ctx = (over: Partial<LockContext> = {}): LockContext => ({ now: NOW, activeGrantExpiresAt: null, sessionStatus: null, ...over });
const locked: LockEntry = { state: 'locked', sessionId: null };

describe('lock state machine', () => {
  it('walks locked, practicing, unlocked, relocked, practicing again', () => {
    let entry = reconcileLock(locked, ctx());
    expect(entry.state).toBe('locked');

    entry = startPractice(entry, 's1');
    expect(entry).toEqual({ state: 'practicing', sessionId: 's1' });
    expect(reconcileLock(entry, ctx({ sessionStatus: 'active' })).state).toBe('practicing');

    // The session finishes and its grant goes active.
    entry = reconcileLock(entry, ctx({ sessionStatus: 'completed', activeGrantExpiresAt: NOW + 600_000 }));
    expect(entry).toEqual({ state: 'unlocked', sessionId: 's1' });

    // Still inside the grant.
    expect(reconcileLock(entry, ctx({ now: NOW + 599_999, activeGrantExpiresAt: NOW + 600_000 })).state).toBe('unlocked');

    // The grant ran out.
    entry = reconcileLock(entry, ctx({ now: NOW + 600_000, activeGrantExpiresAt: null }));
    expect(entry.state).toBe('relocked');
    expect(reconcileLock(entry, ctx({ now: NOW + 700_000 })).state).toBe('relocked');

    expect(startPractice(entry, 's2')).toEqual({ state: 'practicing', sessionId: 's2' });
  });

  it('treats a grant that has already expired as no grant', () => {
    expect(reconcileLock({ state: 'unlocked', sessionId: 's1' }, ctx({ activeGrantExpiresAt: NOW })).state).toBe('relocked');
  });

  it('puts an abandoned, ended or missing practice session back to locked', () => {
    const practicing: LockEntry = { state: 'practicing', sessionId: 's1' };
    expect(reconcileLock(practicing, ctx({ sessionStatus: 'abandoned' })).state).toBe('locked');
    expect(reconcileLock(practicing, ctx({ sessionStatus: 'completed' })).state).toBe('locked');
    expect(reconcileLock(practicing, ctx({ sessionStatus: null })).state).toBe('locked');
  });

  it('unlocks any blocked app while a grant is live, even one the learner activated by hand', () => {
    expect(reconcileLock(locked, ctx({ activeGrantExpiresAt: NOW + 1000 })).state).toBe('unlocked');
    expect(reconcileLock({ state: 'relocked', sessionId: null }, ctx({ activeGrantExpiresAt: NOW + 1000 })).state).toBe('unlocked');
  });

  it('does not restart practice for an unlocked app', () => {
    const unlocked: LockEntry = { state: 'unlocked', sessionId: 's1' };
    expect(startPractice(unlocked, 's2')).toBe(unlocked);
  });

  it('labels each state', () => {
    expect(lockLabel('locked', null)).toBe('Locked');
    expect(lockLabel('practicing', null)).toBe('Practice in progress');
    expect(lockLabel('unlocked', '09:59')).toBe('Unlocked, 09:59 left');
    expect(lockLabel('relocked', null)).toBe('Locked again');
  });

  it('formats a countdown as mm:ss, rounding up', () => {
    expect(formatCountdown(600_000)).toBe('10:00');
    expect(formatCountdown(599_001)).toBe('10:00');
    expect(formatCountdown(59_000)).toBe('00:59');
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
  });
});
