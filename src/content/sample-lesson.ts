// v0 offers a single course: English speakers learning Spanish.
// The shape stays language-agnostic (native/target ids) so more courses can be
// added later without changing the learner store.
import type { LanguageCode, LessonWord } from '@/domain/types';

import seedV0 from '../../content/seed/seed-phrases-v0.json';

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
] as const;

export type Course = {
  /** `courses.id`, from the course's seed file. */
  courseId: string;
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

export const V0_COURSE: Course = {
  courseId: seedV0.courseId,
  nativeLanguage: seedV0.sourceLang,
  targetLanguage: seedV0.targetLang,
};

export const COURSES: readonly Course[] = [V0_COURSE];

export function languageLabel(id: LanguageCode) {
  return LANGUAGES.find((language) => language.id === id)?.label ?? id;
}

type CourseSample = {
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  text: string;
  meaning: string;
  example: string;
};

const SAMPLES: readonly CourseSample[] = [
  {
    nativeLanguage: 'en',
    targetLanguage: 'es',
    text: 'hola',
    meaning: 'hello',
    example: 'Hola, ¿cómo estás?',
  },
];

export function sampleWord(target: LanguageCode, native: LanguageCode): LessonWord {
  const sample = SAMPLES.find((item) => item.targetLanguage === target && item.nativeLanguage === native);
  if (!sample) {
    throw new Error(`No sample lesson for ${native} -> ${target}`);
  }
  return {
    // Stable key stored in knowledge_items.seed_id; keeps "save" idempotent.
    contentId: `sample:${target}:${sample.text}`,
    kind: 'word',
    level: 'A1',
    topic: 'greetings',
    text: sample.text,
    meaning: sample.meaning,
    example: sample.example,
    lessonId: `sample-${target}`,
  };
}
