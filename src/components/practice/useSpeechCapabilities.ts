import { useEffect, useState } from 'react';

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
