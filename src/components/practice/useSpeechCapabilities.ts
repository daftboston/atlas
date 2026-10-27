import { useEffect, useState } from 'react';

import { createSpeechService } from '@/services/speech/registry';
import type { SpeechCapabilities, SpeechService } from '@/services/speech/types';

/**
 * Reads `capabilities()` once. Null until it resolves, and callers must treat null as
 * "no speech": speak controls only appear once the service says it can do them.
 */
export function useSpeechCapabilities(speech: SpeechService): SpeechCapabilities | null {
  const [capabilities, setCapabilities] = useState<SpeechCapabilities | null>(null);

  useEffect(() => {
    let live = true;
    speech
      .capabilities()
      .then((value) => {
        if (live) setCapabilities(value);
      })
      .catch(() => {
        if (live) setCapabilities({ stt: false, tts: false, scoring: 'text-match', onDevice: false, locales: [] });
      });
    return () => {
      live = false;
    };
  }, [speech]);

  return capabilities;
}

/**
 * What the learner can do by voice in this build. `typed-only` is a release build with no speech engine,
 * so no screen may mention a microphone. `simulated` is development, where the mock answers.
 */
export type SpeechMode = 'loading' | 'typed-only' | 'simulated' | 'device';

export function speechModeOf(capabilities: SpeechCapabilities | null): SpeechMode {
  if (!capabilities) return 'loading';
  if (!capabilities.stt) return 'typed-only';
  return capabilities.onDevice ? 'device' : 'simulated';
}

export function useSpeechMode(): SpeechMode {
  const [speech] = useState<SpeechService>(() => createSpeechService());
  return speechModeOf(useSpeechCapabilities(speech));
}
