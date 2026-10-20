/** Score and speech-error shapes shared by the domain scorer and the speech service (architecture §6). */

export const SPEECH_ERRORS = [
  'permissionDenied',
  'unavailable',
  'noSpeech',
  'network',
  'interrupted',
  'unknown',
] as const;

export type SpeechError = (typeof SPEECH_ERRORS)[number];

export type WordMatchStatus = 'correct' | 'close' | 'missing' | 'extra';

export type WordScore = {
  expected: string | null;
  heard: string | null;
  status: WordMatchStatus;
  /** Set only for phoneme scoring. Text-match leaves this null. */
  score: number | null;
};

export type TextMatchResult = {
  overall: number;
  accuracy: number;
  pronunciation: number | null;
  words: WordScore[];
  method: 'text-match';
  /** The target, variant, reading, or romanization that scored best. */
  matchedText: string;
  /** Expected words that matched only after a lenient accent fold. */
  accentHints: string[];
};

export type TextMatchInput = {
  target: string;
  variants: string[];
  transcript: string;
  /** BCP-47 locale. Selects the language profile by its primary tag. */
  locale: string;
  reading: string | null;
  romanization: string | null;
};
