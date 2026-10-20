import type { LanguageProfile } from '@/domain/language/types';
import { splitWords, stripPunctuation } from '@/domain/language/words';

/**
 * French fixture for the roadmap test. Not a course and not shown in the UI.
 * Accents count, so é is not e. Elisions split before punctuation is removed.
 */
const NUMBER_WORDS: Record<number, string> = {
  0: 'zéro',
  1: 'un',
  2: 'deux',
  3: 'trois',
  4: 'quatre',
  5: 'cinq',
};

function splitElisions(text: string): string {
  return text.replace(/\b(qu|l|j)'/g, '$1 ');
}

export const frProfile: LanguageProfile = {
  lang: 'fr',
  diacritics: 'strict',
  numberWords: NUMBER_WORDS,
  normalize(text: string): string {
    const folded = text.normalize('NFC').toLocaleLowerCase('fr').replaceAll('œ', 'oe').replaceAll('æ', 'ae');
    return stripPunctuation(splitElisions(folded));
  },
  tokenize(text: string): string[] {
    return splitWords(text);
  },
};
