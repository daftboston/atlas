/**
 * The blocking demo (docs/architecture.md §7.1) is on in development builds, and in any build that sets
 * EXPO_PUBLIC_BLOCKING_DEMO=1 (eas.json does that for the simulator and preview profiles, never production).
 * It simulates Screen Time as authorized. It does not block anything on the device.
 */
export function isBlockingDemoEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_BLOCKING_DEMO === '1';
}

export const DEMO_LABEL = 'Demo: real blocking needs an iPhone';
