import { createUnavailableSpeechService } from '@/services/speech/unavailable';

it('claims no speech, never invents a transcript, and still scores typed text', async () => {
  const speech = createUnavailableSpeechService();
  await expect(speech.capabilities()).resolves.toEqual({
    stt: false,
    tts: false,
    scoring: 'text-match',
    onDevice: false,
    locales: [],
  });
  await expect(speech.requestPermission()).resolves.toBe('denied');
  await expect(speech.listen({ locale: 'es-MX' }).result).resolves.toMatchObject({
    transcript: '',
    endedBy: 'error',
    error: 'unavailable',
    audioUri: null,
  });
  await expect(speech.speak('hola', { locale: 'es-MX' })).resolves.toBeUndefined();
  const score = await speech.score({
    target: 'Hola',
    variants: [],
    transcript: 'hola',
    inputMode: 'typed',
    locale: 'es-MX',
    reading: null,
    romanization: null,
    audioUri: null,
  });
  expect(score.overall).toBe(100);
});
