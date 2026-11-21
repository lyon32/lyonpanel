import { setRequestLocale } from 'next-intl/server';
import { Home } from '@/components/home/home-page';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home loc={locale === 'en' ? 'en' : 'fr'} />;
}
