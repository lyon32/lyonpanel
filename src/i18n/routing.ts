import { defineRouting } from 'next-intl/routing';

// Adresses internes -> adresses affichées (LLD §6).
export const pathnames = {
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
} as const;

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  // L'accueil « / » n'a pas de traduction : il garde la même adresse.
  pathnames: {
    '/': '/',
    // Réseau, type et numéro sont des identifiants de code : mêmes adresses en FR et EN (LLD §6).
    '/services': '/services',
    '/services/[network]': '/services/[network]',
    '/services/[network]/[type]': '/services/[network]/[type]',
    '/services/[network]/[type]/[id]': '/services/[network]/[type]/[id]',
    '/blog': '/blog',
    // Page interne de démonstration (noindex), même adresse dans les deux langues.
    '/demo': '/demo',
    // Page du lien reçu par email (phase 3) : hors table LLD §6, ajoutée ici.
    '/reset-password': { fr: '/nouveau-mot-de-passe', en: '/reset-password' },
    ...pathnames,
  },
});

export type Locale = (typeof routing.locales)[number];
