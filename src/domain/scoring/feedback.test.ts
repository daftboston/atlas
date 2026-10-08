import { feedbackFor, hintLine } from '@/domain/scoring/feedback';
import type { ListenOutcome } from '@/domain/scoring/feedback';
import { textMatch } from '@/domain/scoring/textMatch';

const locale = 'es-MX';

describe('feedbackFor', () => {
  it('does not show silence or an interruption as a low score', () => {
    const score = textMatch({
      target: 'hola',
      variants: [],
      transcript: 'hola',
      locale,
      reading: null,
      romanization: null,
    });
    const silence: ListenOutcome = { transcript: '', endedBy: 'silence', error: 'noSpeech' };
    const interrupted: ListenOutcome = { transcript: 'hola', endedBy: 'error', error: 'interrupted' };
    expect(feedbackFor(silence, score)).toEqual({ kind: 'silence' });
    expect(feedbackFor(interrupted, score)).toEqual({ kind: 'interrupted' });
  });

  it('picks one hint from the first missing word, then a close word, then an accent', () => {
    const missing = textMatch({
      target: 'hola amigo',
      variants: [],
      transcript: 'hola',
      locale,
      reading: null,
      romanization: null,
    });
    expect(hintLine(missing, 'a note')).toMatch(/^Missing: /);

    const close = textMatch({
      target: 'como',
      variants: [],
      transcript: 'cmo',
      locale,
      reading: null,
      romanization: null,
    });
    expect(hintLine(close, null)).toBe('Close: como');

    const accent = textMatch({
      target: 'días',
      variants: [],
      transcript: 'dias',
      locale,
      reading: null,
      romanization: null,
    });
    expect(hintLine(accent, null)).toBe('Accent: días');
  });
});
