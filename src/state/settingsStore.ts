import { useSyncExternalStore } from 'react';

import type { createSettingsRepo } from '@/data/repositories/settingsRepo';

type SettingsRepo = ReturnType<typeof createSettingsRepo>;

export type SettingsSnapshot = {
  ready: boolean;
  onboardingCompleted: boolean;
  micDenied: boolean;
};

let repository: SettingsRepo | null = null;
let snapshot: SettingsSnapshot = { ready: false, onboardingCompleted: false, micDenied: false };
const listeners = new Set<() => void>();

function publish(next: SettingsSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(): SettingsSnapshot {
  return {
    ready: true,
    onboardingCompleted: repository?.get('onboardingCompleted') === true,
    micDenied: repository?.get('micDenied') === true,
  };
}

export function hydrateSettings(next: SettingsRepo) {
  repository = next;
  publish(read());
}

export function resetSettings() {
  repository = null;
  publish({ ready: false, onboardingCompleted: false, micDenied: false });
}

export function completeOnboarding() {
  repository?.set('onboardingCompleted', true);
  publish({ ...read(), ready: true, onboardingCompleted: true });
}

export function setMicDenied(denied: boolean) {
  repository?.set('micDenied', denied);
  publish({ ...read(), ready: true, micDenied: denied });
}

export function useSettings(): SettingsSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
