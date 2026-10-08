/** Language rules live here and nowhere else in the domain (architecture §10). */
export type DiacriticsPolicy = 'lenient-with-hint' | 'strict' | 'none';

export type LanguageProfile = {
  /** BCP-47 primary tag. */
  lang: string;
  /** Case, punctuation, and script folding. The caller has already applied NFC. */
  normalize(text: string): string;
  diacritics: DiacriticsPolicy;
  /** Required unless `diacritics` is `none`. */
  foldDiacritics?(text: string): string;
  /** Words or graphemes. Must not assume every language uses spaces. */
  tokenize(text: string): string[];
  /** Digits to words, applied before alignment. Keys are 0..100 for Spanish. */
  numberWords?: Record<number, string>;
  altScripts?(item: { reading: string | null; romanization: string | null }): string[];
};
