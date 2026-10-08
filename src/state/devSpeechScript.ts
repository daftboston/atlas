import { useSyncExternalStore } from 'react';

import { mockScripts, type MockListenStep } from '@/services/speech/mock';

/** Scripts the Settings dev menu can queue for the next listen. Default is a match. */
export const DEV_SCRIPT_NAMES = ['perfect', 'close', 'wrong', 'silence', 'denied', 'interrupted'] as const;
export type DevScriptName = (typeof DEV_SCRIPT_NAMES)[number];

let current: DevScriptName = 'perfect';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDevScript(): DevScriptName {
  return current;
}

export function setDevScript(next: DevScriptName) {
  current = next;
  for (const listener of listeners) listener();
}

export function resetDevScript() {
  setDevScript('perfect');
}

export function useDevScript(): DevScriptName {
  return useSyncExternalStore(subscribe, getDevScript, getDevScript);
}

function closeTranscript(target: string): string {
  const chars = Array.from(target);
  if (chars.length <= 1) return `${target}x`;
  return chars.slice(0, -1).join('');
}

/** Build the mock listen step for a target phrase. Wrong uses a transcript that will not match. */
export function scriptedStep(script: DevScriptName, target: string): MockListenStep {
  switch (script) {
    case 'perfect':
      return mockScripts.perfect(target);
    case 'close':
      return mockScripts.close(closeTranscript(target));
    case 'wrong':
      return mockScripts.wrong('nada');
    case 'silence':
      return mockScripts.silence();
    case 'denied':
      return mockScripts.denied();
    case 'interrupted':
      return mockScripts.interrupted();
  }
}
