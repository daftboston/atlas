import { textMatch } from '@/domain/scoring/textMatch';

const spanish = {
  variants: [] as string[],
  locale: 'es-MX',
  reading: null,
  romanization: null,
};

describe('textMatch', () => {
  it('scores an exact phrase as 100 against the target', () => {
    const score = textMatch({ ...spanish, target: 'hola', transcript: 'HOLA' });
    expect(score).toMatchObject({
      overall: 100,
      accuracy: 100,
      pronunciation: null,
      method: 'text-match',
      matchedText: 'hola',
      accentHints: [],
    });
    expect(score.words).toEqual([{ expected: 'hola', heard: 'hola', status: 'correct', score: null }]);
  });

  it('treats a Spanish accent-only miss as correct and records a hint', () => {
    const score = textMatch({ ...spanish, target: 'días', transcript: 'dias' });
    expect(score.accuracy).toBe(100);
    expect(score.accentHints).toEqual(['días']);
    expect(score.words[0]).toMatchObject({ status: 'correct', expected: 'días', heard: 'dias' });
  });

  it('does not treat a missing ñ as an accent', () => {
    const score = textMatch({ ...spanish, target: 'año', transcript: 'ano' });
    expect(score.accentHints).toEqual([]);
    expect(score.words[0]?.status).toBe('close');
    expect(score.accuracy).toBe(50);
  });

  it('marks a one-character edit on a longer word as close', () => {
    const score = textMatch({ ...spanish, target: 'como', transcript: 'cmo' });
    expect(score.words).toEqual([{ expected: 'como', heard: 'cmo', status: 'close', score: null }]);
    expect(score.accuracy).toBe(50);
  });

  it('scores a different word as missing plus extra', () => {
    const score = textMatch({ ...spanish, target: 'gato', transcript: 'perro' });
    expect(score.accuracy).toBe(0);
    expect(score.words.map((word) => word.status).sort()).toEqual(['extra', 'missing']);
  });

  it('turns digits into Spanish number words before alignment', () => {
    const score = textMatch({ ...spanish, target: 'tengo dos gatos', transcript: 'tengo 2 gatos' });
    expect(score.accuracy).toBe(100);
    expect(score.words.map((word) => word.heard)).toEqual(['tengo', 'dos', 'gatos']);
  });

  it('picks a variant when it scores higher than the target', () => {
    const score = textMatch({
      ...spanish,
      target: 'adiós',
      variants: ['hasta luego'],
      transcript: 'hasta luego',
    });
    expect(score.matchedText).toBe('hasta luego');
    expect(score.accuracy).toBe(100);
  });

  it('can match the reading when that candidate scores highest', () => {
    const score = textMatch({
      ...spanish,
      target: 'hello',
      reading: 'hola',
      transcript: 'hola',
    });
    expect(score.matchedText).toBe('hola');
    expect(score.accuracy).toBe(100);
  });

  it('keeps French accents strict and still folds elisions', () => {
    const accent = textMatch({
      target: 'café',
      variants: [],
      transcript: 'cafe',
      locale: 'fr-FR',
      reading: null,
      romanization: null,
    });
    expect(accent.accentHints).toEqual([]);
    expect(accent.words[0]?.status).toBe('close');
    expect(accent.accuracy).toBe(50);

    const elision = textMatch({
      target: "j'aime",
      variants: [],
      transcript: 'j aime',
      locale: 'fr-FR',
      reading: null,
      romanization: null,
    });
    expect(elision.accuracy).toBe(100);
    expect(elision.words.map((word) => word.status)).toEqual(['correct', 'correct']);
  });

  it('gives typed and spoken transcripts the same score for the same text', () => {
    const spoken = textMatch({ ...spanish, target: 'buenos días', transcript: 'buenos dias' });
    const typed = textMatch({ ...spanish, target: 'buenos días', transcript: 'buenos dias' });
    expect(typed).toEqual(spoken);
    expect(spoken.accentHints).toEqual(['días']);
  });
});
