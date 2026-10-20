import type { ScreenTimeAvailability, ScreenTimeEvent, ScreenTimeService, ShieldSelection } from './types';

/**
 * v0 Screen Time. Availability stays `unavailable` until a dev toggle simulates
 * authorization. Nothing here is read by domain code.
 */
export function createScreenTimeStub(): ScreenTimeService & {
  setSimulated(authorized: boolean): void;
  events(): ScreenTimeEvent[];
} {
  let availability: ScreenTimeAvailability = 'unavailable';
  let selection: ShieldSelection | null = null;
  const events: ScreenTimeEvent[] = [];
  const listeners = new Set<(event: ScreenTimeEvent) => void>();

  function emit(event: ScreenTimeEvent) {
    events.push(event);
    listeners.forEach((listener) => listener(event));
  }

  return {
    async availability() {
      return availability;
    },
    async requestAuthorization() {
      return availability;
    },
    async pickSelection() {
      return selection;
    },
    async getSelection() {
      return selection;
    },
    async applyShield() {},
    async liftShield(untilMs: number) {
      if (availability !== 'authorized') throw new Error('Screen Time is unavailable');
      emit({ type: 'shieldLifted', until: untilMs });
    },
    async restoreShield() {
      emit({ type: 'shieldRestored' });
    },
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setSimulated(authorized: boolean) {
      availability = authorized ? 'authorized' : 'unavailable';
      selection = authorized ? { token: 'dev', appCount: 1, categoryCount: 0 } : null;
      emit({ type: 'authorizationChanged', availability });
    },
    events() {
      return events;
    },
  };
}

let current = createScreenTimeStub();

export function getScreenTimeService() {
  return current;
}

export function setScreenTimeSimulation(authorized: boolean) {
  current.setSimulated(authorized);
}

export function resetScreenTimeStub() {
  current = createScreenTimeStub();
}
