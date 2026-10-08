import { createSpeechService, speechImplFromEnv } from '@/services/speech/registry';

describe('speech registry', () => {
  it('defaults to the mock', async () => {
    expect(speechImplFromEnv(undefined)).toBe('mock');
    expect(speechImplFromEnv('')).toBe('mock');
    const speech = createSpeechService();
    await expect(speech.capabilities()).resolves.toMatchObject({ stt: true, onDevice: false });
  });

  it('selects the honest iOS placeholder and rejects cloud for v0', async () => {
    expect(speechImplFromEnv('ios')).toBe('ios');
    const speech = createSpeechService('ios');
    await expect(speech.capabilities()).resolves.toMatchObject({ stt: false, tts: false, onDevice: true });
    expect(() => createSpeechService('cloud')).toThrow('Cloud speech is not part of v0');
    expect(() => speechImplFromEnv('whisper')).toThrow('Unknown EXPO_PUBLIC_SPEECH_IMPL');
  });
});
