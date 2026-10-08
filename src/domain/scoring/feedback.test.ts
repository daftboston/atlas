import { feedbackFor } from '@/domain/scoring/feedback';
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
});
