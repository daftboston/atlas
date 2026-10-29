import { createIosSpeechService } from '@/services/speech/ios';
import { createMockSpeechService } from '@/services/speech/mock';
import { createUnavailableSpeechService } from '@/services/speech/unavailable';
import type { SpeechService } from '@/services/speech/types';

export type SpeechImpl = 'mock' | 'ios' | 'cloud' | 'unavailable';

/**
 * `EXPO_PUBLIC_SPEECH_IMPL` picks the engine. When it is not set, development builds and Jest
 * (`__DEV__` true) use the mock, and a release build gets `unavailable`. A release build never selects the
 * mock, even when `EXPO_PUBLIC_SPEECH_IMPL=mock` was baked into the bundle: it falls back to `unavailable`
 * with a warning, so a shipped build can never pass a step with a scripted "perfect" answer.
 */
export function speechImplFromEnv(value = process.env.EXPO_PUBLIC_SPEECH_IMPL, dev: boolean = __DEV__): SpeechImpl {
  if (value === undefined || value === '') return dev ? 'mock' : 'unavailable';
  if (value === 'mock' && !dev) {
    console.warn('EXPO_PUBLIC_SPEECH_IMPL=mock is ignored in a release build; using "unavailable".');
    return 'unavailable';
  }
  if (value === 'mock' || value === 'ios' || value === 'cloud' || value === 'unavailable') return value;
  throw new Error(`Unknown EXPO_PUBLIC_SPEECH_IMPL "${value}"`);
}

export function createSpeechService(impl: SpeechImpl = speechImplFromEnv()): SpeechService {
  if (impl === 'mock') return createMockSpeechService();
  if (impl === 'ios') return createIosSpeechService();
  if (impl === 'unavailable') return createUnavailableSpeechService();
  throw new Error('Cloud speech is not part of v0');
}
