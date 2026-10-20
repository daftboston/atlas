import { RATING_HARD_BELOW } from '@/domain/config';
import type { SpeechError, TextMatchResult } from '@/domain/scoring/types';

export type ListenOutcome = {
  transcript: string;
  endedBy: 'silence' | 'maxDuration' | 'user' | 'error';
  error?: SpeechError;
};

export type FeedbackState =
  | { kind: 'silence' }
  | { kind: 'denied' }
  | { kind: 'interrupted' }
  | { kind: 'unavailable' }
  | { kind: 'pass'; score: TextMatchResult }
  | { kind: 'try-again'; score: TextMatchResult };

/**
 * Error outcomes stay messages. A transcript is a pass only at Good or better
 * (overall >= 75). The scorer does not apply the Easy cap.
 */
export function feedbackFor(outcome: ListenOutcome, score: TextMatchResult | null): FeedbackState {
  if (outcome.error === 'permissionDenied') return { kind: 'denied' };
  if (outcome.error === 'interrupted') return { kind: 'interrupted' };
  if (outcome.error === 'noSpeech' || outcome.transcript.trim().length === 0) return { kind: 'silence' };
  if (outcome.error === 'unavailable' || outcome.error === 'network' || outcome.error === 'unknown') {
    return { kind: 'unavailable' };
  }
  if (!score) return { kind: 'silence' };
  if (score.overall >= RATING_HARD_BELOW) return { kind: 'pass', score };
  return { kind: 'try-again', score };
}

/** One hint: the first missing word, otherwise the first close word, otherwise the item notes. */
export function hintLine(score: TextMatchResult, notes: string | null): string | null {
  const missing = score.words.find((word) => word.status === 'missing' && word.expected);
  if (missing?.expected) return `Missing: ${missing.expected}`;
  const close = score.words.find((word) => word.status === 'close' && word.expected);
  if (close?.expected) return `Close: ${close.expected}`;
  if (score.accentHints[0]) return `Accent: ${score.accentHints[0]}`;
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}
