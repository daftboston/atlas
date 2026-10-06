import { CEFR_LEVELS, ITEM_KINDS, type CefrLevel, type ItemKind } from '@/domain/types';

/** learning-loop §11 seed file, schemaVersion 1. */
export type SeedItem = {
  seedId: string;
  level: CefrLevel;
  topic: string;
  kind: ItemKind;
  prompt: string;
  target: string;
  variants: string[];
  reading?: string | null;
  romanization?: string | null;
  notes?: string | null;
};

export type SeedFile = {
  schemaVersion: 1;
  courseId: string;
  deckId: string;
  sourceLang: string;
  targetLang: string;
  speechLocales: string[];
  defaultSpeechLocale: string;
  items: SeedItem[];
};

const isString = (value: unknown): value is string => typeof value === 'string';
const isNonEmptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0;
const isOptionalString = (value: unknown) => value === undefined || value === null || isString(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

// Placeholder for the LanguageProfile normalize() of architecture §6 (not built yet):
// catches exact and case-only duplicates.
const roughKey = (text: string) => text.normalize('NFC').trim().toLowerCase();

/** Returns every §11 violation found; an empty list means the file is valid. */
export function seedErrors(input: unknown): string[] {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) return ['seed file must be an object'];
  const seed = input as Record<string, unknown>;

  if (seed.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  for (const key of ['courseId', 'deckId', 'sourceLang', 'targetLang', 'defaultSpeechLocale'] as const) {
    if (!isNonEmptyString(seed[key])) errors.push(`${key} must be a non-empty string`);
  }
  if (!isStringArray(seed.speechLocales) || seed.speechLocales.length === 0) {
    errors.push('speechLocales must be a non-empty array of strings');
  } else if (isString(seed.defaultSpeechLocale) && !seed.speechLocales.includes(seed.defaultSpeechLocale)) {
    errors.push('defaultSpeechLocale must be one of speechLocales');
  }
  if (!Array.isArray(seed.items)) return [...errors, 'items must be an array'];

  const seen = new Set<string>();
  seed.items.forEach((raw: unknown, index) => {
    const where = `items[${index}]`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${where} must be an object`);
      return;
    }
    const item = raw as Record<string, unknown>;
    if (!isNonEmptyString(item.seedId)) errors.push(`${where}.seedId must be a non-empty string`);
    else if (seen.has(item.seedId)) errors.push(`${where}.seedId ${item.seedId} is duplicated`);
    else seen.add(item.seedId);
    if (!CEFR_LEVELS.includes(item.level as CefrLevel)) errors.push(`${where}.level must be one of ${CEFR_LEVELS.join(', ')}`);
    if (!ITEM_KINDS.includes(item.kind as ItemKind)) errors.push(`${where}.kind must be one of ${ITEM_KINDS.join(', ')}`);
    for (const key of ['topic', 'prompt', 'target'] as const) {
      if (!isNonEmptyString(item[key])) errors.push(`${where}.${key} must be a non-empty string`);
    }
    for (const key of ['reading', 'romanization', 'notes'] as const) {
      if (!isOptionalString(item[key])) errors.push(`${where}.${key} must be a string or null`);
    }
    if (!isStringArray(item.variants)) {
      errors.push(`${where}.variants must be an array of strings`);
    } else if (isString(item.target)) {
      const keys = [item.target, ...item.variants].map(roughKey);
      if (new Set(keys).size !== keys.length) errors.push(`${where}.variants duplicate the target or each other`);
    }
  });
  return errors;
}

export function parseSeed(input: unknown): SeedFile {
  const errors = seedErrors(input);
  if (errors.length > 0) throw new Error(`Invalid seed file:\n${errors.join('\n')}`);
  return input as SeedFile;
}
