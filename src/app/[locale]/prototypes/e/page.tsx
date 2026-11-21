import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Home } from '@/components/home/home-page';

export const metadata: Metadata = {
  title: 'LyonPanel - aperçu de l’accueil',
  robots: { index: false, follow: false },
};

export default async function PrototypeEPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home loc={locale === 'en' ? 'en' : 'fr'} />;
}
