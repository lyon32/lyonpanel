import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/constants';

export type Lang = 'fr' | 'en';

const OG_LOCALE: Record<Lang, string> = { fr: 'fr_FR', en: 'en_US' };

export const asLang = (locale: string): Lang => (locale === 'en' ? 'en' : 'fr');

/** URL absolue d'une page du catalogue dans une langue (les adresses /services sont les mêmes en FR et EN). */
export const catalogUrl = (lang: Lang, path: string): string => `${SITE_URL}/${lang}${path}`;

export interface CatalogMetaInput {
  lang: Lang;
  /** Chemin sans langue ni paramètre, ex. `/services/tiktok`. */
  path: string;
  title: string;
  description: string;
  /** `noindex, follow` (recherche, fiche) ; la page reste lisible par Google mais hors résultats. */
  noindex?: boolean;
}

/** Métadonnées complètes : canonical sans paramètre, hreflang fr/en/x-default, Open Graph, Twitter. */
export function catalogMetadata({
  lang,
  path,
  title,
  description,
  noindex = false,
}: CatalogMetaInput): Metadata {
  const url = catalogUrl(lang, path);
  return {
    title,
    description,
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    alternates: {
      canonical: url,
      languages: {
        fr: catalogUrl('fr', path),
        en: catalogUrl('en', path),
        'x-default': catalogUrl('fr', path),
      },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: OG_LOCALE[lang],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Garde un titre de page sous 60 caractères en coupant le nom, pas la marque. */
export function fitTitle(name: string, suffix = ` – ${SITE_NAME}`, max = 60): string {
  const room = max - suffix.length;
  const cut = name.length > room ? `${name.slice(0, room - 1).trimEnd()}…` : name;
  return `${cut}${suffix}`;
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbLd(lang: Lang, crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: catalogUrl(lang, c.path),
    })),
  };
}

export function itemListLd(lang: Lang, items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: catalogUrl(lang, it.path),
    })),
  };
}

/** Adresses des réseaux et des listes (type) qui contiennent au moins un service. */
export function catalogPaths(
  networks: { network: string; types: { type: string; services: unknown[] }[] }[],
): string[] {
  return networks.flatMap((n) => {
    const types = n.types.filter((t) => t.services.length > 0);
    return types.length === 0
      ? []
      : [`/services/${n.network}`, ...types.map((t) => `/services/${n.network}/${t.type}`)];
  });
}

/** Prend la version la plus longue qui tient en 160 caractères (140-160 visés) ; sinon la plus courte. */
export function pickDescription(variants: string[], max = 160): string {
  const fits = variants.filter((v) => v.length <= max).sort((a, b) => b.length - a.length);
  return fits[0] ?? variants.reduce((a, b) => (b.length < a.length ? b : a));
}
