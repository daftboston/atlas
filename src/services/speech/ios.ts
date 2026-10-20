import { textMatch } from '@/domain/scoring/textMatch';

import type { ListenResult, ListenSession, ScoreInput, SpeechService } from '@/services/speech/types';

/**
 * On-device speech placeholder. OQ-8 is still open: this simulator has not been
 * shown to recognize or speak es-MX / es-ES, so capabilities stay false.
 * `listen` does not invent a transcript. Scoring still uses text-match for typed input.
 */
export function createIosSpeechService(): SpeechService {
  return {
    async capabilities() {
      return { stt: false, tts: false, scoring: 'text-match', onDevice: true, locales: [] };
    },
    async getPermission() {
      return 'undetermined';
    },
    async requestPermission() {
      return 'denied';
    },
    listen(): ListenSession {
      const result = Promise.resolve<ListenResult>({
        transcript: '',
        confidence: null,
        durationMs: 0,
        endedBy: 'error',
        audioUri: null,
        error: 'unavailable',
      });
      return {
        onPartial() {
          return () => undefined;
        },
        onLevel() {
          return () => undefined;
        },
        stop() {
          return undefined;
        },
        cancel() {
          return undefined;
        },
        result,
      };
    },
    async speak() {
      return undefined;
    },
    async stopSpeaking() {
      return undefined;
    },
    score(input: ScoreInput) {
      return Promise.resolve(
        textMatch({
          target: input.target,
          variants: input.variants,
          transcript: input.transcript,
          locale: input.locale,
          reading: input.reading,
          romanization: input.romanization,
        }),
      );
    },
  };
}
