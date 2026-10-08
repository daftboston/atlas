import { createIosSpeechService } from '@/services/speech/ios';
import { createMockSpeechService } from '@/services/speech/mock';
import type { SpeechService } from '@/services/speech/types';

export type SpeechImpl = 'mock' | 'ios' | 'cloud';

/** `EXPO_PUBLIC_SPEECH_IMPL` defaults to mock so the simulator never pretends the mic is live. */
export function speechImplFromEnv(value = process.env.EXPO_PUBLIC_SPEECH_IMPL): SpeechImpl {
  if (value === undefined || value === '' || value === 'mock') return 'mock';
  if (value === 'ios' || value === 'cloud') return value;
  throw new Error(`Unknown EXPO_PUBLIC_SPEECH_IMPL "${value}"`);
}

export function createSpeechService(impl: SpeechImpl = speechImplFromEnv()): SpeechService {
  if (impl === 'mock') return createMockSpeechService();
  if (impl === 'ios') return createIosSpeechService();
  throw new Error('Cloud speech is not part of v0');
}
