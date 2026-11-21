import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Home } from '@/components/home/home-page';
import { JsonLd } from '@/components/seo/json-ld';
import { seoPageMetadata } from '@/lib/seo/public-meta';
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/seo/site-jsonld';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata(locale, 'home', '');
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'fr';
  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildWebSiteJsonLd(lang)} />
      <Home loc={lang} />
    </>
  );
}
