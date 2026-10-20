/** Shared token helpers. No language-specific letters live here. */

export function stripPunctuation(text: string): string {
  return text
    .replace(/[¿¡。、]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/** Replace a whole digit run with `numberWords[n]` when that entry exists. */
export function replaceNumberTokens(text: string, numberWords: Record<number, string> | undefined): string {
  if (!numberWords) return text;
  return text.replace(/\d+/g, (digits) => {
    const value = Number(digits);
    const word = numberWords[value];
    return word ?? digits;
  });
}
