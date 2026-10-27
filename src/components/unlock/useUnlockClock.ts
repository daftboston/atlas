import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { UnlockGrantRow } from '@/data/repositories/unlockRepo';
import { nextUnlockChangeMs } from '@/domain/unlock/unlockRules';
import { refreshUnlock } from '@/state/unlockStore';

/**
 * Keeps the Unlock tab current without polling. Returns "now" for the countdown labels.
 *
 * - Countdown: a 1 Hz ticker that only moves the label, and only while a grant is active
 *   and the tab is focused. It never touches the database.
 * - State change: one timeout aimed at the next moment the list can change on its own
 *   (an active grant ending, an earned grant forfeited, or the 04:00 rollover). When it
 *   fires it reconciles, and the new grants schedule the next one.
 * - Foreground: reconciles whenever the app returns to 'active'.
 * - Focus: reconciles when the tab gains focus.
 * Every timer and listener is cleared on blur, on change and on unmount.
 */
export function useUnlockClock(grants: readonly UnlockGrantRow[]): number {
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reconcile = useCallback(async () => {
    await refreshUnlock();
    if (mounted.current) setNow(Date.now());
  }, []);

  // Reconcile when the tab gains focus.
  useFocusEffect(
    useCallback(() => {
      void reconcile();
    }, [reconcile]),
  );

  // (a) Countdown ticker: only while a grant is running and the tab is focused.
  const hasActiveGrant = grants.some((grant) => grant.status === 'active' && grant.expiresAt !== null);
  useFocusEffect(
    useCallback(() => {
      if (!hasActiveGrant) return;
      setNow(Date.now());
      const ticker = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(ticker);
    }, [hasActiveGrant]),
  );

  // (b) One timeout for the next state change. `grants` is a new array after each refresh,
  // so every reconcile re-aims it.
  useEffect(() => {
    const current = Date.now();
    // nextUnlockChangeMs is always later than `current`, so the delay is at least 1 ms and
    // this can't spin.
    const delay = nextUnlockChangeMs(grants, current) - current;
    const timeout = setTimeout(() => void reconcile(), delay);
    return () => clearTimeout(timeout);
  }, [grants, reconcile]);

  // (c) Reconcile when the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcile();
    });
    return () => subscription.remove();
  }, [reconcile]);

  return now;
}
