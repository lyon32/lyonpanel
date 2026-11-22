import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/shared/coming-soon';
import { seoPageMetadata } from '@/lib/seo/public-meta';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata(locale, 'terms', '/terms', { noindex: true });
}

// Page provisoire : le contenu réel arrive dans une phase suivante.
export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComingSoon />;
}
