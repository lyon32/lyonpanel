import { describe, expect, it } from 'vitest';
import { routing, pathnames } from '@/i18n/routing';

const table: Record<string, { fr: string; en: string }> = {
  '/order': { fr: '/commander', en: '/order' },
  '/orders': { fr: '/commandes', en: '/orders' },
  '/add-funds': { fr: '/recharger', en: '/add-funds' },
  '/dashboard': { fr: '/tableau-de-bord', en: '/dashboard' },
  '/transactions': { fr: '/transactions', en: '/transactions' },
  '/favorites': { fr: '/favoris', en: '/favorites' },
  '/login': { fr: '/connexion', en: '/login' },
  '/register': { fr: '/inscription', en: '/register' },
  '/forgot-password': { fr: '/mot-de-passe-oublie', en: '/forgot-password' },
  '/tickets': { fr: '/support', en: '/support' },
  '/referral': { fr: '/parrainage', en: '/referral' },
  '/account': { fr: '/compte', en: '/account' },
  '/privacy': { fr: '/confidentialite', en: '/privacy' },
  '/terms': { fr: '/conditions', en: '/terms' },
};

describe('routing', () => {
  it('déclare les langues fr et en, fr par défaut, préfixe toujours présent', () => {
    expect([...routing.locales]).toEqual(['fr', 'en']);
    expect(routing.defaultLocale).toBe('fr');
    expect(routing.localePrefix).toBe('always');
  });

  it('contient exactement les 14 adresses internes', () => {
    expect(Object.keys(pathnames).sort()).toEqual(Object.keys(table).sort());
  });

  describe.each(Object.entries(table))('adresse %s', (internal, expected) => {
    it(`vaut ${expected.fr} en français`, () => {
      expect((pathnames as Record<string, Record<string, string>>)[internal]?.fr).toBe(expected.fr);
    });
    it(`vaut ${expected.en} en anglais`, () => {
      expect((pathnames as Record<string, Record<string, string>>)[internal]?.en).toBe(expected.en);
    });
  });
});
