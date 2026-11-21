import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactContent } from '@/components/contact/contact-content';
import { JsonLd } from '@/components/seo/json-ld';
import { seoHomeCrumb, seoPageMetadata } from '@/lib/seo/public-meta';
import { buildBreadcrumbJsonLd } from '@/lib/seo/site-jsonld';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return seoPageMetadata(locale, 'contact', '/contact');
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'contact' });
  const lang = locale === 'en' ? 'en' : 'fr';
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          await seoHomeCrumb(locale),
          { name: t('title'), url: `/${lang}/contact` },
        ])}
      />
      <ContactContent locale={locale} />
    </>
  );
}
