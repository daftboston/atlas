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
