import { useCallback, useRef } from 'react';

/** Taps closer together than this count as one. Long enough for a double tap, short enough that a real retry works. */
export const SINGLE_TAP_WINDOW_MS = 800;

/**
 * Wraps a button handler that navigates or starts something, so a double tap runs it once.
 * `Pressable` can deliver several presses before React re-renders, so a `disabled` prop is not enough.
 */
export function useSingleTap<Args extends unknown[]>(handler: (...args: Args) => void, windowMs = SINGLE_TAP_WINDOW_MS) {
  const last = useRef<number | null>(null);
  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      if (last.current !== null && now - last.current < windowMs) return;
      last.current = now;
      handler(...args);
    },
    [handler, windowMs],
  );
}
