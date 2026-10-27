import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { UnlockGrantRow } from '@/data/repositories/unlockRepo';
import { refreshUnlock } from '@/state/unlockStore';

import { useUnlockClock } from './useUnlockClock';

// Focus is driven by the test: a blurred screen runs no focus effects.
let mockFocused = true;
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => (mockFocused ? effect() : undefined), [effect, mockFocused]);
    },
  };
});
jest.mock('@/state/unlockStore', () => ({ refreshUnlock: jest.fn(async () => {}) }));

const NOW = Date.parse('2026-10-07T15:00:00.000Z');
const refresh = jest.mocked(refreshUnlock);

const grant = (patch: Partial<UnlockGrantRow>): UnlockGrantRow => ({
  id: 'g',
  sessionId: 's',
  minutes: 10,
  status: 'earned',
  earnedAt: NOW,
  activatedAt: null,
  expiresAt: null,
  expiresUnusedAt: NOW + 12 * 3_600_000,
  screenTimeApplied: false,
  ...patch,
});
const running = (secondsLeft: number) =>
  grant({ status: 'active', activatedAt: NOW, expiresAt: NOW + secondsLeft * 1000 });

// Stable arrays: the real store hands out a new array only after a refresh.
const NONE: UnlockGrantRow[] = [];
const EARNED = [grant({})];
const RUNNING_5_SEC = [running(5)];
const RUNNING_10_MIN = [running(600)];

// Lets React's own scheduler tasks run, so getTimerCount only sees the hook's timers.
const settle = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

describe('useUnlockClock', () => {
  let appStateHandler: ((state: AppStateStatus) => void) | null;
  const removeAppState = jest.fn();
  let setIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockFocused = true;
    refresh.mockClear();
    removeAppState.mockClear();
    appStateHandler = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: AppStateStatus) => void) => {
      appStateHandler = handler;
      return { remove: removeAppState };
    }) as never);
    setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('starts no interval while idle, only one timeout for the next change (the 04:00 rollover)', async () => {
    const { unmount } = await renderHook(() => useUnlockClock(NONE));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
    // Focus reconciled once. A minute of idling reconciled nothing more.
    expect(refresh).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('does not tick for an earned grant that is not running', async () => {
    await renderHook(() => useUnlockClock(EARNED));
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('ticks the countdown once a second while a grant runs, without reconciling on each tick', async () => {
    const { result } = await renderHook(() => useUnlockClock(RUNNING_10_MIN));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(NOW);
    refresh.mockClear();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3_000);
    });

    expect(result.current).toBe(NOW + 3_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reconciles once, at the moment the active grant ends', async () => {
    await renderHook(() => useUnlockClock(RUNNING_5_SEC));
    refresh.mockClear();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(4_999);
    });
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('reconciles when an earned grant is forfeited, which is the next change on its own', async () => {
    const grants = [grant({ expiresUnusedAt: NOW + 30_000 })];
    await renderHook(() => useUnlockClock(grants));
    refresh.mockClear();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(29_999);
    });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops the ticker when the grant is no longer running', async () => {
    const { rerender } = await renderHook((grants: UnlockGrantRow[]) => useUnlockClock(grants), {
      initialProps: RUNNING_10_MIN,
    });
    await settle();
    expect(jest.getTimerCount()).toBe(2);

    await rerender([grant({ status: 'expired', activatedAt: NOW, expiresAt: NOW })]);

    await settle();
    expect(jest.getTimerCount()).toBe(1); // only the rollover timeout
  });

  it('reconciles when the app returns to the foreground, and only then', async () => {
    await renderHook(() => useUnlockClock(NONE));
    refresh.mockClear();

    await act(async () => appStateHandler?.('background'));
    await act(async () => appStateHandler?.('inactive'));
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => appStateHandler?.('active'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops the countdown ticker when the tab loses focus, and resumes it on focus', async () => {
    const { rerender } = await renderHook(() => useUnlockClock(RUNNING_10_MIN));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    await settle();
    expect(jest.getTimerCount()).toBe(2);

    mockFocused = false;
    await rerender(undefined);
    await settle();
    expect(jest.getTimerCount()).toBe(1);

    mockFocused = true;
    await rerender(undefined);
    await settle();
    expect(jest.getTimerCount()).toBe(2);
  });

  it('cleans up every timer and listener on unmount', async () => {
    const { unmount } = await renderHook(() => useUnlockClock(RUNNING_10_MIN));
    await settle();
    expect(jest.getTimerCount()).toBe(2);
    expect(removeAppState).not.toHaveBeenCalled();

    await unmount();
    await settle();

    expect(jest.getTimerCount()).toBe(0);
    expect(removeAppState).toHaveBeenCalledTimes(1);
  });
});
