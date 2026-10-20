import type { LanguageProfile } from '@/domain/language/types';
import { esProfile } from '@/domain/language/profiles/es';
import { frProfile } from '@/domain/language/profiles/fr';

const PROFILES: readonly LanguageProfile[] = [esProfile, frProfile];

/** Regional locales share the profile whose `lang` is their primary tag. */
export function languageProfile(locale: string): LanguageProfile {
  const primary = locale.trim().toLowerCase().split('-')[0] ?? '';
  const profile = PROFILES.find((item) => item.lang === primary);
  if (!profile) {
    throw new Error(`No language profile for "${locale}"`);
  }
  return profile;
}
