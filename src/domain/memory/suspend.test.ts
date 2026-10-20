import { suspendItem, unsuspendItem } from '@/domain/memory/suspend';

describe('suspend and unsuspend', () => {
  it('restores the exact previous status, mastered included', () => {
    const suspended = suspendItem({ status: 'mastered', statusBeforeSuspend: null });
    expect(suspended).toEqual({ status: 'suspended', statusBeforeSuspend: 'mastered' });
    expect(unsuspendItem(suspended)).toEqual({ status: 'mastered', statusBeforeSuspend: null });
  });

  it('leaves an already suspended item alone', () => {
    const state = { status: 'suspended' as const, statusBeforeSuspend: 'learning' as const };
    expect(suspendItem(state)).toBe(state);
  });

  it('does not invent a status when none was saved', () => {
    const state = { status: 'suspended' as const, statusBeforeSuspend: null };
    expect(unsuspendItem(state)).toBe(state);
  });
});
