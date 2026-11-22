import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PRIVATE_ROBOTS } from '@/lib/seo/indexing';
import { Home } from '@/components/home/home-page';

export const metadata: Metadata = {
  title: 'LyonPanel - aperçu de l’accueil',
  robots: { index: false, follow: false } satisfies typeof PRIVATE_ROBOTS,
};

export default async function PrototypeEPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home loc={locale === 'en' ? 'en' : 'fr'} />;
}
