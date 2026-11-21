import { SITE_NAME } from '@/lib/constants';
import { getSiteUrl } from '@/lib/seo/site-url';

export interface Crumb {
  name: string;
  /** URL absolue ou chemin commençant par `/`. */
  url: string;
}

const CONTEXT = 'https://schema.org' as const;

/** Organisation : jamais d'avis ni de note inventés. */
export function buildOrganizationJsonLd() {
  const site = getSiteUrl();
  return {
    '@context': CONTEXT,
    '@type': 'Organization' as const,
    name: SITE_NAME,
    url: site,
    logo: `${site}/brand/favicon-512.png`,
  };
}

export function buildWebSiteJsonLd(lang: 'fr' | 'en') {
  const site = getSiteUrl();
  return {
    '@context': CONTEXT,
    '@type': 'WebSite' as const,
    name: SITE_NAME,
    url: `${site}/${lang}`,
    inLanguage: lang,
  };
}

export function buildBreadcrumbJsonLd(crumbs: Crumb[]) {
  const site = getSiteUrl();
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList' as const,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      name: c.name,
      item: c.url.startsWith('/') ? `${site}${c.url}` : c.url,
    })),
  };
}
