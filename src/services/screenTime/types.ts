export type ScreenTimeAvailability = 'unavailable' | 'notAuthorized' | 'authorized';

/** Opaque selection from the native picker. The stub never creates a real one. */
export type ShieldSelection = {
  token: string;
  appCount: number;
  categoryCount: number;
};

export type ScreenTimeEvent = { type: 'shieldLifted'; until: number } | { type: 'shieldRestored' } | { type: 'authorizationChanged'; availability: ScreenTimeAvailability };

export type ScreenTimeService = {
  availability(): Promise<ScreenTimeAvailability>;
  requestAuthorization(): Promise<ScreenTimeAvailability>;
  pickSelection(): Promise<ShieldSelection | null>;
  getSelection(): Promise<ShieldSelection | null>;
  applyShield(selection: ShieldSelection): Promise<void>;
  /** Temporary unlock window. Rejects when Screen Time is unavailable. */
  liftShield(untilMs: number): Promise<void>;
  restoreShield(): Promise<void>;
  onEvent(cb: (event: ScreenTimeEvent) => void): () => void;
};
