import type { MetadataRoute } from 'next';
import { countServices, isRichNetwork } from '@/components/platform/network-summary';
import { isSiteIndexable } from '@/lib/seo/indexing';
import { getSiteUrl } from '@/lib/seo/site-url';
import { buildPublicCatalog } from '@/server/catalog/present-catalog';
import { listPublicServices } from '@/server/catalog/public-catalog';

const LANGS = ['fr', 'en'] as const;

/** Une entrée par langue, chacune avec ses liens hreflang. */
function entries(path: string): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const languages = {
    fr: `${site}/fr${path}`,
    en: `${site}/en${path}`,
    'x-default': `${site}/fr${path}`,
  };
  return LANGS.map((lang) => ({ url: `${site}/${lang}${path}`, alternates: { languages } }));
}

// Mise à jour toutes les heures : le catalogue change après chaque synchronisation.
export const revalidate = 3600;

// Vide tant que le site n'est pas indexable. Ensuite : pages publiques fixes et réseaux « riches ».
// Jamais les fiches de service, /demo, /prototypes, connexion, espace client ni admin.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSiteIndexable()) return [];
  let networks: string[] = [];
  try {
    // Lecture de la vue publique uniquement.
    const catalog = buildPublicCatalog(await listPublicServices(), {
      currency: 'XAF',
      usdXafRate: 1,
      locale: 'fr',
    });
    networks = catalog.networks
      .filter((n) => isRichNetwork(n.network, countServices(n)))
      .map((n) => `/services/${n.network}`);
  } catch {
    // Base injoignable à la construction : on garde les pages fixes.
  }
  return ['', '/services', '/faq', '/contact', ...networks].flatMap(entries);
}
