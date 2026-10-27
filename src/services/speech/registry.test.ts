import { languageProfile } from '@/domain/language/registry';
import { createSpeechService, speechImplFromEnv } from '@/services/speech/registry';

describe('speech registry', () => {
  it('defaults to the mock under __DEV__ and in Jest', async () => {
    expect(__DEV__).toBe(true);
    expect(speechImplFromEnv(undefined)).toBe('mock');
    expect(speechImplFromEnv('')).toBe('mock');
    expect(speechImplFromEnv(undefined, true)).toBe('mock');
    const speech = createSpeechService();
    await expect(speech.capabilities()).resolves.toMatchObject({ stt: true, tts: true, onDevice: false });
  });

  it('never defaults to the mock in a release build', async () => {
    expect(speechImplFromEnv(undefined, false)).toBe('unavailable');
    expect(speechImplFromEnv('', false)).toBe('unavailable');
    const speech = createSpeechService(speechImplFromEnv(undefined, false));
    await expect(speech.capabilities()).resolves.toEqual({
      stt: false,
      tts: false,
      scoring: 'text-match',
      onDevice: false,
      locales: [],
    });
  });

  it('picks the default per call from __DEV__ when no env var is set', async () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    const env = process.env.EXPO_PUBLIC_SPEECH_IMPL;
    delete process.env.EXPO_PUBLIC_SPEECH_IMPL;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      await expect(createSpeechService().capabilities()).resolves.toMatchObject({ stt: false, tts: false });
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
      if (env !== undefined) process.env.EXPO_PUBLIC_SPEECH_IMPL = env;
    }
  });

  it('never selects the mock in a release build, even when it is set explicitly', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(speechImplFromEnv('mock', false)).toBe('unavailable');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('EXPO_PUBLIC_SPEECH_IMPL=mock');
    } finally {
      warn.mockRestore();
    }
  });

  it('still honors the other explicit settings in a release build', () => {
    expect(speechImplFromEnv('ios', false)).toBe('ios');
    expect(speechImplFromEnv('unavailable', true)).toBe('unavailable');
  });

  it('selects the honest iOS placeholder and rejects cloud for v0', async () => {
    expect(speechImplFromEnv('ios')).toBe('ios');
    const speech = createSpeechService('ios');
    await expect(speech.capabilities()).resolves.toMatchObject({ stt: false, tts: false, onDevice: true });
    expect(() => createSpeechService('cloud')).toThrow('Cloud speech is not part of v0');
    expect(() => speechImplFromEnv('whisper')).toThrow('Unknown EXPO_PUBLIC_SPEECH_IMPL');
  });

  it('reports honest mock capabilities: simulated, not on-device, only locales a language profile serves', async () => {
    const caps = await createSpeechService('mock').capabilities();
    expect(caps.onDevice).toBe(false);
    expect(caps.locales.length).toBeGreaterThan(0);
    for (const locale of caps.locales) expect(() => languageProfile(locale)).not.toThrow();
  });
});
