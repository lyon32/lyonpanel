import { describe, expect, it } from 'vitest';
import { pickLocale } from '@/i18n/detect-locale';

describe('pickLocale', () => {
  it('prend le cookie valide en priorité sur Accept-Language', () => {
    expect(pickLocale({ cookie: 'en', acceptLanguage: 'fr-FR,fr;q=0.9' })).toBe('en');
    expect(pickLocale({ cookie: 'fr', acceptLanguage: 'en-US' })).toBe('fr');
  });
  it('ignore un cookie invalide', () => {
    expect(pickLocale({ cookie: 'de', acceptLanguage: 'en-US' })).toBe('en');
  });
  it.each([
    ['fr', 'fr'],
    ['en', 'en'],
    ['fr-CA', 'fr'],
    ['en-US', 'en'],
    ['en-US,en;q=0.9,fr;q=0.8', 'en'],
    ['de-DE,de;q=0.9,en;q=0.5', 'en'],
  ])('Accept-Language "%s" donne %s', (acceptLanguage, expected) => {
    expect(pickLocale({ acceptLanguage })).toBe(expected);
  });
  it.each([['de-DE'], ['es'], ['ar'], [''], [undefined]])(
    'langue non gérée ou vide (%s) donne fr',
    (acceptLanguage) => {
      expect(pickLocale({ acceptLanguage })).toBe('fr');
    },
  );
  it('sans cookie ni en-tête donne fr', () => {
    expect(pickLocale({})).toBe('fr');
  });
});
