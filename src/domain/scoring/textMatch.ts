import { languageProfile } from '@/domain/language/registry';
import type { LanguageProfile } from '@/domain/language/types';
import { replaceNumberTokens } from '@/domain/language/words';

import type { TextMatchInput, TextMatchResult, WordScore } from '@/domain/scoring/types';

type Surface = { raw: string; folded: string };
type Relation = 'correct' | 'close';
type Step =
  | { kind: Relation; expected: Surface; heard: Surface }
  | { kind: 'missing'; expected: Surface }
  | { kind: 'extra'; heard: Surface };

/**
 * Engine-independent text match (architecture §6). Language rules come only from
 * the profile for `input.locale`. Typed and spoken transcripts take the same path.
 */
export function textMatch(input: TextMatchInput): TextMatchResult {
  const profile = languageProfile(input.locale);
  const candidates = [input.target, ...input.variants, input.reading, input.romanization].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  const heard = surfaces(input.transcript, profile);

  let best: { accuracy: number; words: WordScore[]; hints: string[]; matchedText: string } | null = null;
  for (const candidate of candidates) {
    const scored = scoreCandidate(surfaces(candidate, profile), heard, profile);
    if (!best || scored.accuracy > best.accuracy) {
      best = { ...scored, matchedText: candidate };
    }
  }

  const accuracy = best?.accuracy ?? 0;
  return {
    overall: accuracy,
    accuracy,
    pronunciation: null,
    words: best?.words ?? [],
    method: 'text-match',
    matchedText: best?.matchedText ?? input.target,
    accentHints: best?.hints ?? [],
  };
}

function surfaces(text: string, profile: LanguageProfile): Surface[] {
  const normalized = profile.normalize(text.normalize('NFC'));
  const withNumbers = replaceNumberTokens(normalized, profile.numberWords);
  return profile.tokenize(withNumbers).map((raw) => ({
    raw,
    folded: comparisonForm(raw, profile),
  }));
}

function comparisonForm(raw: string, profile: LanguageProfile): string {
  if (profile.diacritics !== 'lenient-with-hint') return raw;
  return profile.foldDiacritics ? profile.foldDiacritics(raw) : raw;
}

function scoreCandidate(
  expected: Surface[],
  heard: Surface[],
  profile: LanguageProfile,
): { accuracy: number; words: WordScore[]; hints: string[] } {
  const steps = align(expected, heard);
  const words: WordScore[] = [];
  const hints: string[] = [];
  let correct = 0;
  let close = 0;

  for (const step of steps) {
    if (step.kind === 'missing') {
      words.push({ expected: step.expected.raw, heard: null, status: 'missing', score: null });
      continue;
    }
    if (step.kind === 'extra') {
      words.push({ expected: null, heard: step.heard.raw, status: 'extra', score: null });
      continue;
    }
    if (step.kind === 'correct') correct += 1;
    if (step.kind === 'close') close += 1;
    const accentOnly =
      step.kind === 'correct' &&
      profile.diacritics === 'lenient-with-hint' &&
      step.expected.raw !== step.heard.raw;
    if (accentOnly) hints.push(step.expected.raw);
    words.push({
      expected: step.expected.raw,
      heard: step.heard.raw,
      status: step.kind,
      score: null,
    });
  }

  const accuracy = expected.length === 0 ? 0 : (100 * (correct + 0.5 * close)) / expected.length;
  return { accuracy, words, hints };
}

function align(expected: Surface[], heard: Surface[]): Step[] {
  const rows = expected.length;
  const cols = heard.length;
  const cost: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  const back: ('correct' | 'close' | 'missing' | 'extra' | null)[][] = Array.from({ length: rows + 1 }, () =>
    Array<'correct' | 'close' | 'missing' | 'extra' | null>(cols + 1).fill(null),
  );

  for (let i = 1; i <= rows; i += 1) {
    cost[i]![0] = i;
    back[i]![0] = 'missing';
  }
  for (let j = 1; j <= cols; j += 1) {
    cost[0]![j] = j;
    back[0]![j] = 'extra';
  }

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      const relation = relate(expected[i - 1]!, heard[j - 1]!);
      let best = cost[i - 1]![j]! + 1;
      let how: 'correct' | 'close' | 'missing' | 'extra' = 'missing';
      const extraCost = cost[i]![j - 1]! + 1;
      if (extraCost < best) {
        best = extraCost;
        how = 'extra';
      }
      if (relation) {
        const diagonal = cost[i - 1]![j - 1]! + (relation === 'close' ? 0.5 : 0);
        if (diagonal <= best) {
          best = diagonal;
          how = relation;
        }
      }
      cost[i]![j] = best;
      back[i]![j] = how;
    }
  }

  const steps: Step[] = [];
  let i = rows;
  let j = cols;
  while (i > 0 || j > 0) {
    const how = back[i]?.[j];
    if ((how === 'correct' || how === 'close') && i > 0 && j > 0) {
      steps.push({ kind: how, expected: expected[i - 1]!, heard: heard[j - 1]! });
      i -= 1;
      j -= 1;
    } else if (how === 'extra' && j > 0) {
      steps.push({ kind: 'extra', heard: heard[j - 1]! });
      j -= 1;
    } else if (i > 0) {
      steps.push({ kind: 'missing', expected: expected[i - 1]! });
      i -= 1;
    } else if (j > 0) {
      steps.push({ kind: 'extra', heard: heard[j - 1]! });
      j -= 1;
    } else {
      break;
    }
  }
  steps.reverse();
  return steps;
}

function relate(expected: Surface, heard: Surface): Relation | null {
  if (expected.folded === heard.folded) return 'correct';
  if (Array.from(expected.raw).length <= 1) return null;
  const limit = Math.max(1, Math.floor(Array.from(expected.raw).length / 4));
  return editDistance(expected.folded, heard.folded) <= limit ? 'close' : null;
}

function editDistance(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      const replace = previous + (a[i - 1] === b[j - 1] ? 0 : 1);
      row[j] = Math.min(replace, row[j]! + 1, row[j - 1]! + 1);
      previous = current;
    }
  }
  return row[b.length]!;
}
