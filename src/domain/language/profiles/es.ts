import type { LanguageProfile } from '@/domain/language/types';
import { splitWords, stripPunctuation } from '@/domain/language/words';

/**
 * Spanish. Accents fold for matching and ñ stays distinct (architecture §10.1).
 * The literals in this file are the profile. Other layers look the profile up by tag.
 */
const ACCENT_TO_PLAIN: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
};

const ONES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'] as const;
const TEENS = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
] as const;
const TENS = ['veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'] as const;
const VEINTI = [
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
] as const;

function spanishNumber(value: number): string {
  if (value < 10) return ONES[value] ?? String(value);
  if (value < 20) return TEENS[value - 10] ?? String(value);
  if (value < 30) return value === 20 ? 'veinte' : (VEINTI[value - 21] ?? String(value));
  if (value === 100) return 'cien';
  const tens = TENS[Math.floor(value / 10) - 2];
  const ones = value % 10;
  if (!tens) return String(value);
  return ones === 0 ? tens : `${tens} y ${ONES[ones]}`;
}

const numberWords: Record<number, string> = Object.fromEntries(
  Array.from({ length: 101 }, (_, value) => [value, spanishNumber(value)]),
);

export function foldSpanishDiacritics(text: string): string {
  return Array.from(text)
    .map((char) => ACCENT_TO_PLAIN[char] ?? char)
    .join('');
}

export const esProfile: LanguageProfile = {
  lang: 'es',
  diacritics: 'lenient-with-hint',
  numberWords,
  normalize(text: string): string {
    return stripPunctuation(text.normalize('NFC').toLocaleLowerCase('es'));
  },
  foldDiacritics: foldSpanishDiacritics,
  tokenize(text: string): string[] {
    return splitWords(text);
  },
};
