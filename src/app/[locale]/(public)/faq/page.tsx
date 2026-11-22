import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/seo/json-ld';
import { seoHomeCrumb, seoPageMetadata } from '@/lib/seo/public-meta';
import { buildBreadcrumbJsonLd } from '@/lib/seo/site-jsonld';
import { FaqContent } from '@/components/faq/faq-content';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata(locale, 'faq', '/faq');
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'faq' });
  const lang = locale === 'en' ? 'en' : 'fr';
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          await seoHomeCrumb(locale),
          { name: t('title'), url: `/${lang}/faq` },
        ])}
      />
      <FaqContent locale={locale} />
    </>
  );
}
