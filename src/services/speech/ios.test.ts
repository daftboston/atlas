import { createIosSpeechService } from '@/services/speech/ios';

it('reports the on-device engine as unavailable and does not invent a transcript', async () => {
  const speech = createIosSpeechService();
  await expect(speech.capabilities()).resolves.toEqual({
    stt: false,
    tts: false,
    scoring: 'text-match',
    onDevice: true,
    locales: [],
  });
  await expect(speech.listen({ locale: 'es-MX' }).result).resolves.toMatchObject({
    transcript: '',
    audioUri: null,
    error: 'unavailable',
  });
  const score = await speech.score({
    target: 'hola',
    variants: [],
    transcript: 'hola',
    inputMode: 'typed',
    locale: 'es-MX',
    reading: null,
    romanization: null,
    audioUri: null,
  });
  expect(score.accuracy).toBe(100);
});
