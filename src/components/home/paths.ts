export type Loc = 'fr' | 'en';

// Adresses localisées (src/i18n/routing.ts)
export const PATHS: Record<Loc, Record<string, string>> = {
  fr: {
    register: '/fr/inscription',
    login: '/fr/connexion',
    services: '/fr/services',
  },
  en: {
    register: '/en/register',
    login: '/en/login',
    services: '/en/services',
  },
};
