import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { isSiteIndexable } from '@/lib/seo/indexing';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export type SeoPageKey = 'home' | 'services' | 'faq' | 'contact' | 'privacy' | 'terms' | 'blog';

const asLang = (locale: string) => (locale === 'en' ? 'en' : 'fr');

/** Métadonnées d'une page publique à partir des textes `seo.<clé>` (FR/EN). */
export async function seoPageMetadata(
  locale: string,
  key: SeoPageKey,
  path: string,
  options: { noindex?: boolean } = {},
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const meta = buildPageMetadata({
    lang: asLang(locale),
    path,
    title: t(`${key}.title`),
    description: t(`${key}.description`),
  });
  // Page provisoire : lisible mais hors des résultats tant que son contenu n'existe pas.
  return options.noindex ? { ...meta, robots: { index: false, follow: isSiteIndexable() } } : meta;
}

/** Entrées « Accueil » du fil d'Ariane JSON-LD, dans la langue de la page. */
export async function seoHomeCrumb(locale: string) {
  const t = await getTranslations({ locale, namespace: 'seo' });
  return { name: t('breadcrumbHome'), url: `/${asLang(locale)}` };
}
