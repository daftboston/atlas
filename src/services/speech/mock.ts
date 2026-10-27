import { V0_SPEECH_LOCALES } from '@/content/sample-lesson';
import { textMatch } from '@/domain/scoring/textMatch';
import type { SpeechError } from '@/domain/scoring/types';

import type {
  ListenOptions,
  ListenResult,
  ListenSession,
  PermissionState,
  ScoreInput,
  SpeechService,
} from '@/services/speech/types';

/** One scripted listen result. `delayMs` 0 settles on the next microtask. */
export type MockListenStep = {
  transcript?: string;
  error?: SpeechError;
  endedBy?: ListenResult['endedBy'];
  delayMs?: number;
};

export const mockScripts = {
  perfect: (transcript: string): MockListenStep => ({ transcript, endedBy: 'silence' }),
  close: (transcript: string): MockListenStep => ({ transcript, endedBy: 'silence' }),
  wrong: (transcript: string): MockListenStep => ({ transcript, endedBy: 'silence' }),
  silence: (): MockListenStep => ({ transcript: '', error: 'noSpeech', endedBy: 'silence' }),
  denied: (): MockListenStep => ({ transcript: '', error: 'permissionDenied', endedBy: 'error' }),
  interrupted: (): MockListenStep => ({ transcript: '', error: 'interrupted', endedBy: 'error' }),
};

export type MockSpeechService = SpeechService & {
  enqueue(step: MockListenStep): void;
  setPermission(state: PermissionState): void;
  setSpeakDelay(delayMs: number): void;
};

/**
 * Locales the mock reports: the v0 course's speech locales, which its language profile can score.
 * It does not claim any locale the scorer can't serve.
 */
export const MOCK_SPEECH_LOCALES: readonly string[] = V0_SPEECH_LOCALES;

/**
 * Deterministic speech (architecture §6). Steps are consumed in order.
 * An empty queue is silence. This is the simulator path until OQ-8 is verified.
 */
export function createMockSpeechService(): MockSpeechService {
  const queue: MockListenStep[] = [];
  let permission: PermissionState = 'granted';
  let speakDelayMs = 0;
  let speakTimer: ReturnType<typeof setTimeout> | null = null;
  let finishSpeak: (() => void) | null = null;
  let activeCancel: (() => void) | null = null;

  function stopSpeakingNow() {
    const finish = finishSpeak;
    finishSpeak = null;
    if (speakTimer) clearTimeout(speakTimer);
    speakTimer = null;
    finish?.();
  }

  return {
    async capabilities() {
      return { stt: true, tts: true, scoring: 'text-match', onDevice: false, locales: [...MOCK_SPEECH_LOCALES] };
    },
    async getPermission() {
      return permission;
    },
    async requestPermission() {
      return permission;
    },
    setPermission(state) {
      permission = state;
    },
    setSpeakDelay(delayMs) {
      speakDelayMs = delayMs;
    },
    enqueue(step) {
      queue.push(step);
    },
    listen(opts: ListenOptions): ListenSession {
      stopSpeakingNow();
      activeCancel?.();

      const blocked = permission !== 'granted';
      const step = blocked ? mockScripts.denied() : (queue.shift() ?? mockScripts.silence());
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let resolveResult: (result: ListenResult) => void = () => undefined;
      let rejectResult: (error: Error) => void = () => undefined;
      const partials = new Set<(partial: string) => void>();
      const levels = new Set<(level: number) => void>();

      const result = new Promise<ListenResult>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      function settle(run: () => void) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (activeCancel === cancel) activeCancel = null;
        run();
      }

      function finish(endedBy: ListenResult['endedBy']) {
        settle(() => {
          const error = step.error;
          const transcript = error ? '' : (step.transcript ?? '');
          if (transcript.length > 0) {
            for (const listener of partials) listener(transcript);
            for (const listener of levels) listener(0);
          }
          resolveResult({
            transcript,
            confidence: transcript.length === 0 ? null : 1,
            durationMs: step.delayMs ?? 0,
            endedBy: error ? 'error' : endedBy,
            audioUri: null,
            ...(error ? { error } : {}),
          });
        });
      }

      function cancel() {
        settle(() => rejectResult(new Error('cancelled')));
      }

      activeCancel = cancel;
      const delay = step.delayMs ?? 0;
      const endedBy = step.endedBy ?? (delay > 0 ? 'maxDuration' : 'silence');
      if (delay === 0) queueMicrotask(() => finish(endedBy));
      else timer = setTimeout(() => finish(endedBy), Math.min(delay, opts.maxDurationMs ?? delay));

      return {
        onPartial(cb) {
          partials.add(cb);
          return () => partials.delete(cb);
        },
        onLevel(cb) {
          levels.add(cb);
          return () => levels.delete(cb);
        },
        stop() {
          finish('user');
        },
        cancel,
        result,
      };
    },
    speak() {
      stopSpeakingNow();
      activeCancel?.();
      return new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (speakTimer) clearTimeout(speakTimer);
          speakTimer = null;
          if (finishSpeak === finish) finishSpeak = null;
          resolve();
        };
        finishSpeak = finish;
        if (speakDelayMs === 0) finish();
        else speakTimer = setTimeout(finish, speakDelayMs);
      });
    },
    async stopSpeaking() {
      stopSpeakingNow();
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
