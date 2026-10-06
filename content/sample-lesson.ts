export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'pt', label: 'Portuguese' },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]['id'];

export type SampleWord = {
  text: string;
  meaning: string;
  example: string;
  lessonId: string;
};

const SAMPLES: Record<LanguageId, { text: string; example: string; meanings: Record<LanguageId, string> }> = {
  en: {
    text: 'hello',
    example: 'Hello, how are you?',
    meanings: { en: 'hello', es: 'hola', pt: 'olá' },
  },
  es: {
    text: 'hola',
    example: 'Hola, ¿cómo estás?',
    meanings: { en: 'hello', es: 'hola', pt: 'olá' },
  },
  pt: {
    text: 'olá',
    example: 'Olá, tudo bem?',
    meanings: { en: 'hello', es: 'hola', pt: 'olá' },
  },
};

export function sampleWord(target: LanguageId, native: LanguageId): SampleWord {
  const sample = SAMPLES[target];
  return {
    text: sample.text,
    meaning: sample.meanings[native],
    example: sample.example,
    lessonId: `sample-${target}`,
  };
}

export function wordId(language: LanguageId, text: string) {
  return `${language}:${text}`;
}
