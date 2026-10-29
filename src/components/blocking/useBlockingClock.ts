import { useEffect } from 'react';

import { refreshBlocking, useBlocking, type BlockingSnapshot } from '@/state/blockingStore';

/** Refreshes the lock states every second, so a countdown ticks and an expired unlock relocks while a screen is open. */
export function useBlockingClock(): BlockingSnapshot {
  useEffect(() => {
    void refreshBlocking();
    const timer = setInterval(() => void refreshBlocking(), 1000);
    return () => clearInterval(timer);
  }, []);
  return useBlocking();
}
