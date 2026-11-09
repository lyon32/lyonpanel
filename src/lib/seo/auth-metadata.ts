import type { Metadata } from 'next';
import { pathnames, routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from '@/lib/constants';

type AuthPage = 'login' | 'register' | 'forgot-password' | 'reset-password';
type Lang = 'fr' | 'en';

const TEXTS: Record<AuthPage, Record<Lang, { title: string; description: string }>> = {
  login: {
    fr: {
      title: 'Connexion',
      description: 'Connectez-vous à votre compte LyonPanel avec votre email ou votre téléphone.',
    },
    en: {
      title: 'Log in',
      description: 'Log in to your LyonPanel account with your email or phone number.',
    },
  },
  register: {
    fr: {
      title: 'Inscription',
      description: 'Créez votre compte LyonPanel avec votre email, votre téléphone et votre pays.',
    },
    en: {
      title: 'Sign up',
      description: 'Create your LyonPanel account with your email, phone number and country.',
    },
  },
  'forgot-password': {
    fr: {
      title: 'Mot de passe oublié',
      description: 'Recevez un lien par email pour choisir un nouveau mot de passe LyonPanel.',
    },
    en: {
      title: 'Forgot password',
      description: 'Get an email link to choose a new LyonPanel password.',
    },
  },
  'reset-password': {
    fr: {
      title: 'Nouveau mot de passe',
      description: 'Choisissez un nouveau mot de passe pour votre compte LyonPanel.',
    },
    en: {
      title: 'New password',
      description: 'Choose a new password for your LyonPanel account.',
    },
  },
};

const ROUTES: Record<AuthPage, string> = {
  login: '/login',
  register: '/register',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
};

function pathFor(page: AuthPage, lang: Lang): string {
  const key = ROUTES[page] as keyof typeof pathnames | '/reset-password';
  const entry = routing.pathnames[key as keyof typeof routing.pathnames] as
    string | { fr: string; en: string };
  return `/${lang}${typeof entry === 'string' ? entry : entry[lang]}`;
}

// Pages de compte : jamais indexées (noindex, nofollow), canonical sans paramètres.
export function authMetadata(page: AuthPage, locale: string): Metadata {
  const lang: Lang = locale === 'en' ? 'en' : 'fr';
  const { title, description } = TEXTS[page][lang];
  const url = `${SITE_URL}${pathFor(page, lang)}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: url,
      languages: {
        fr: `${SITE_URL}${pathFor(page, 'fr')}`,
        en: `${SITE_URL}${pathFor(page, 'en')}`,
        'x-default': `${SITE_URL}${pathFor(page, 'fr')}`,
      },
    },
    openGraph: {
      title: `${title} – ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      locale: lang === 'fr' ? 'fr_FR' : 'en_US',
    },
  };
}
