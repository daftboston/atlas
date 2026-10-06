// v0 offers a single course: English speakers learning Spanish.
// The shape stays language-agnostic (native/target ids) so more courses can be
// added later without changing the learner store.
export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]['id'];

export type Course = {
  nativeLanguage: LanguageId;
  targetLanguage: LanguageId;
};

export const V0_COURSE: Course = { nativeLanguage: 'en', targetLanguage: 'es' };

export const COURSES: readonly Course[] = [V0_COURSE];

export function languageLabel(id: LanguageId) {
  return LANGUAGES.find((language) => language.id === id)?.label ?? id;
}

export type SampleWord = {
  text: string;
  meaning: string;
  example: string;
  lessonId: string;
};

type CourseSample = Course & {
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

export function sampleWord(target: LanguageId, native: LanguageId): SampleWord {
  const sample = SAMPLES.find((item) => item.targetLanguage === target && item.nativeLanguage === native);
  if (!sample) {
    throw new Error(`No sample lesson for ${native} -> ${target}`);
  }
  return {
    text: sample.text,
    meaning: sample.meaning,
    example: sample.example,
    lessonId: `sample-${target}`,
  };
}

export function wordId(language: LanguageId, text: string) {
  return `${language}:${text}`;
}
