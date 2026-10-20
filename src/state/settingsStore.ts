import { useSyncExternalStore } from 'react';

import type { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { DAILY_NEW_LIMIT, DEFAULT_DESIRED_RETENTION, SESSION_SIZE } from '@/domain/config';
import { clampDailyNewLimit, clampSessionSize, normalizeRetention } from '@/domain/settings/limits';

type SettingsRepo = ReturnType<typeof createSettingsRepo>;

export type SettingsSnapshot = {
  ready: boolean;
  onboardingCompleted: boolean;
  micDenied: boolean;
  dailyNewLimit: number;
  sessionSize: number;
  desiredRetention: number;
  speechLocale: string | null;
};

const EMPTY: SettingsSnapshot = {
  ready: false,
  onboardingCompleted: false,
  micDenied: false,
  dailyNewLimit: DAILY_NEW_LIMIT,
  sessionSize: SESSION_SIZE,
  desiredRetention: DEFAULT_DESIRED_RETENTION,
  speechLocale: null,
};

let repository: SettingsRepo | null = null;
let speechLocale: string | null = null;
let snapshot: SettingsSnapshot = EMPTY;
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
    dailyNewLimit: repository?.get('dailyNewLimit') ?? DAILY_NEW_LIMIT,
    sessionSize: repository?.get('sessionSize') ?? SESSION_SIZE,
    desiredRetention: repository?.get('desiredRetention') ?? DEFAULT_DESIRED_RETENTION,
    speechLocale,
  };
}

export function hydrateSettings(next: SettingsRepo, locale: string | null = null) {
  repository = next;
  speechLocale = locale;
  publish(read());
}

export function resetSettings() {
  repository = null;
  speechLocale = null;
  publish(EMPTY);
}

export function setKnownSpeechLocale(locale: string | null) {
  speechLocale = locale;
  if (repository) publish(read());
}

export function setDailyNewLimit(value: number) {
  repository?.set('dailyNewLimit', clampDailyNewLimit(value));
  if (repository) publish(read());
}

export function setSessionSize(value: number) {
  repository?.set('sessionSize', clampSessionSize(value));
  if (repository) publish(read());
}

export function setDesiredRetention(value: number) {
  repository?.set('desiredRetention', normalizeRetention(value));
  if (repository) publish(read());
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
