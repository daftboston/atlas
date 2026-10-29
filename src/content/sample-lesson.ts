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

/** Speech locale for the v0 course, taken from the seed file rather than hard-coded here. */
export const V0_SPEECH_LOCALE = seedV0.defaultSpeechLocale;
/** Every speech locale the v0 course offers. */
export const V0_SPEECH_LOCALES: readonly string[] = seedV0.speechLocales;

export function languageLabel(id: LanguageCode) {
  return LANGUAGES.find((language) => language.id === id)?.label ?? id;
}

/**
 * Each course's sample lesson teaches one item from that course's seed deck, so the
 * saved word is the seeded KnowledgeItem rather than a second copy of it.
 */
type CourseSample = {
  courseId: string;
  seedId: string;
  example: string;
};

const SAMPLES: readonly CourseSample[] = [
  {
    courseId: seedV0.courseId,
    seedId: 'es-v0-001', // Hola / Hello
    example: 'Hola, ¿cómo estás?',
  },
];

const SEED_ITEMS: Record<string, readonly { seedId: string; target: string; prompt: string }[]> = {
  [seedV0.courseId]: seedV0.items,
};

export function sampleWord(target: LanguageCode, native: LanguageCode): LessonWord {
  const course = COURSES.find((item) => item.targetLanguage === target && item.nativeLanguage === native);
  const sample = course && SAMPLES.find((item) => item.courseId === course.courseId);
  const seedItem = sample && SEED_ITEMS[sample.courseId]?.find((item) => item.seedId === sample.seedId);
  if (!course || !sample || !seedItem) {
    throw new Error(`No sample lesson for ${native} -> ${target}`);
  }
  return {
    seedId: seedItem.seedId,
    text: seedItem.target,
    meaning: seedItem.prompt,
    example: sample.example,
    lessonId: `sample-${target}`,
  };
}
