import { RATING_AGAIN_BELOW, RATING_EASY_AT, RATING_HARD_BELOW } from '@/domain/config';
import type { FsrsRating, InputMode, PromptType } from '@/domain/types';

export type GradeInput = {
  status: 'scored' | 'failed' | 'skipped' | 'captured';
  promptType: PromptType;
  inputMode: InputMode;
  tryNumber: number;
  overall: number | null;
};

/**
 * learning-loop §4.1 and §5.3. Null means this attempt does not update FSRS.
 * Only try 1 is graded. A technical failure is never graded, so the next answer can be try 1.
 */
export function gradeAttempt(input: GradeInput): FsrsRating | null {
  if (input.status === 'failed' || input.tryNumber !== 1) return null;
  if (input.status === 'skipped' || input.status === 'captured' || input.overall === null) return 1;

  let rating: FsrsRating;
  if (input.overall < RATING_AGAIN_BELOW) rating = 1;
  else if (input.overall < RATING_HARD_BELOW) rating = 2;
  else if (input.overall < RATING_EASY_AT) rating = 3;
  else rating = 4;

  // Easy is spoken recall on the first try. Listen-repeat and typing cap at Good.
  // Accent-only misses already score as correct, so they do not lower this rating.
  const easyAllowed = input.promptType === 'recall-speak' && input.inputMode === 'speech';
  if (!easyAllowed && rating === 4) rating = 3;
  return rating;
}
