import { textMatch } from '@/domain/scoring/textMatch';

import type { ListenResult, ListenSession, ScoreInput, SpeechService } from '@/services/speech/types';

/**
 * Release default when `EXPO_PUBLIC_SPEECH_IMPL` is not set (architecture §6).
 * There is no recognizer and no voice, so capabilities say so and `listen` never
 * invents a transcript. The UI offers typed answers only. Typed scoring still uses text-match.
 */
export function createUnavailableSpeechService(): SpeechService {
  return {
    async capabilities() {
      return { stt: false, tts: false, scoring: 'text-match', onDevice: false, locales: [] };
    },
    async getPermission() {
      return 'denied';
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
