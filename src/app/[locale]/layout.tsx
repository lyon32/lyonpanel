import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { routing } from '@/i18n/routing';
import { atkinson, plexMono, publicSans } from '@/lib/fonts';
import { SITE_NAME } from '@/lib/constants';
import '@/styles/globals.css';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// hreflang : chaque langue pointe vers sa page d'accueil, x-default vers le français.
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return { title: SITE_NAME };
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: SITE_NAME,
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: { fr: '/fr', en: '/en', 'x-default': '/fr' },
    },
  };
}

// Ce layout est la racine de l'application : il porte <html lang> selon la langue.
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${publicSans.variable} ${atkinson.variable} ${plexMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
