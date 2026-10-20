import { esProfile } from '@/domain/language/profiles/es';
import { frProfile } from '@/domain/language/profiles/fr';
import { languageProfile } from '@/domain/language/registry';

describe('languageProfile', () => {
  it('uses the primary tag for both Spanish speech locales', () => {
    expect(languageProfile('es-MX')).toBe(esProfile);
    expect(languageProfile('es-ES')).toBe(esProfile);
  });

  it('returns the French fixture without a schema or scorer change', () => {
    expect(languageProfile('fr-FR')).toBe(frProfile);
    expect(frProfile.diacritics).toBe('strict');
  });

  it('rejects a locale that has no profile', () => {
    expect(() => languageProfile('de-DE')).toThrow('No language profile');
  });
});
