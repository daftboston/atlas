import { feedbackFor } from '@/domain/scoring/feedback';
import { textMatch } from '@/domain/scoring/textMatch';

import { createMockSpeechService, mockScripts } from '@/services/speech/mock';

const locale = 'es-MX';

describe('mock speech', () => {
  it('plays a scripted transcript and never returns an audio uri', async () => {
    const speech = createMockSpeechService();
    const partials: string[] = [];
    speech.enqueue(mockScripts.perfect('hola'));
    const session = speech.listen({ locale });
    session.onPartial((partial) => partials.push(partial));
    await expect(session.result).resolves.toMatchObject({
      transcript: 'hola',
      audioUri: null,
      endedBy: 'silence',
      confidence: 1,
    });
    expect(partials).toEqual(['hola']);
  });

  it('cancels the previous listen when a second one starts', async () => {
    const speech = createMockSpeechService();
    speech.enqueue(mockScripts.perfect('hola'));
    speech.enqueue(mockScripts.perfect('adiós'));
    const first = speech.listen({ locale });
    const second = speech.listen({ locale });
    await expect(first.result).rejects.toThrow('cancelled');
    await expect(second.result).resolves.toMatchObject({ transcript: 'adiós' });
  });

  it('stops playback when listening starts', async () => {
    const speech = createMockSpeechService();
    speech.setSpeakDelay(5000);
    const spoken = speech.speak('hola', { locale });
    speech.enqueue(mockScripts.perfect('hola'));
    await speech.listen({ locale }).result;
    await spoken;
  });

  it('lets the learner stop early', async () => {
    const speech = createMockSpeechService();
    speech.enqueue({ transcript: 'hola', delayMs: 5000 });
    const session = speech.listen({ locale });
    session.stop();
    await expect(session.result).resolves.toMatchObject({ transcript: 'hola', endedBy: 'user' });
  });

  it('does not consume a scripted phrase while permission is denied', async () => {
    const speech = createMockSpeechService();
    speech.setPermission('denied');
    speech.enqueue(mockScripts.perfect('hola'));
    await expect(speech.listen({ locale }).result).resolves.toMatchObject({ error: 'permissionDenied', transcript: '' });
    speech.setPermission('granted');
    await expect(speech.listen({ locale }).result).resolves.toMatchObject({ transcript: 'hola' });
  });

  it('maps the six scripts onto pass, try-again, silence, denied, and interrupted', async () => {
    const cases = [
      { step: mockScripts.perfect('hola'), target: 'hola', kind: 'pass' },
      { step: mockScripts.close('cmo'), target: 'como', kind: 'try-again' },
      { step: mockScripts.wrong('perro'), target: 'gato', kind: 'try-again' },
      { step: mockScripts.silence(), target: 'hola', kind: 'silence' },
      { step: mockScripts.denied(), target: 'hola', kind: 'denied' },
      { step: mockScripts.interrupted(), target: 'hola', kind: 'interrupted' },
    ];
    for (const item of cases) {
      const speech = createMockSpeechService();
      speech.enqueue(item.step);
      const outcome = await speech.listen({ locale }).result;
      const score = outcome.transcript
        ? textMatch({
            target: item.target,
            variants: [],
            transcript: outcome.transcript,
            locale,
            reading: null,
            romanization: null,
          })
        : null;
      expect(feedbackFor(outcome, score).kind).toBe(item.kind);
    }
  });

  it('scores typed and spoken input with the same text match', async () => {
    const speech = createMockSpeechService();
    const base = {
      target: 'días',
      variants: [],
      transcript: 'dias',
      locale,
      reading: null,
      romanization: null,
      audioUri: null,
    };
    const spoken = await speech.score({ ...base, inputMode: 'speech' });
    const typed = await speech.score({ ...base, inputMode: 'typed' });
    expect(typed).toEqual(spoken);
    expect(spoken.pronunciation).toBeNull();
  });
});
