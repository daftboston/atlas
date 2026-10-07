import seedV0 from '../../../content/seed/seed-phrases-v0.json';
import { parseSeed, seedErrors } from './seedSchema';

describe('seed schema (learning-loop §11)', () => {
  it('content/seed/seed-phrases-v0.json is valid', () => {
    expect(seedErrors(seedV0)).toEqual([]);
    const seed = parseSeed(seedV0);
    expect(seed.courseId).toBe('en-es-v0');
    expect(seed.defaultSpeechLocale).toBe('es-MX');
    expect(seed.items).toHaveLength(60);
  });

  it('reports what is wrong with an invalid file', () => {
    const bad = {
      ...seedV0,
      defaultSpeechLocale: 'fr-FR',
      items: [
        { ...seedV0.items[0], level: 'B1' },
        { ...seedV0.items[0], kind: 'idiom', variants: ['hola'] },
      ],
    };
    expect(seedErrors(bad)).toEqual([
      'defaultSpeechLocale must be one of speechLocales',
      'items[0].level must be one of A1, A2',
      'items[1].seedId es-v0-001 is duplicated',
      'items[1].kind must be one of word, phrase, sentence',
      'items[1].variants duplicate the target or each other',
    ]);
    expect(() => parseSeed(bad)).toThrow('Invalid seed file');
  });
});
