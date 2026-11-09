import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';
import { catalogPaths } from '@/lib/seo/catalog-seo';
import { buildPublicCatalog } from '@/server/catalog/present-catalog';
import { listPublicServices } from '@/server/catalog/public-catalog';

const LANGS = ['fr', 'en'] as const;

/** Une entrée par langue, chacune avec ses liens hreflang. */
function entries(path: string): MetadataRoute.Sitemap {
  const languages = {
    fr: `${SITE_URL}/fr${path}`,
    en: `${SITE_URL}/en${path}`,
    'x-default': `${SITE_URL}/fr${path}`,
  };
  return LANGS.map((lang) => ({ url: `${SITE_URL}/${lang}${path}`, alternates: { languages } }));
}

// Mise à jour toutes les heures : le catalogue change après chaque synchronisation.
export const revalidate = 3600;

// Pages publiques indexables seulement : accueil, services, réseaux, listes.
// Jamais /demo, client, admin, ni les fiches de service (noindex).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let paths: string[] = [];
  try {
    // Lecture de la vue publique uniquement.
    const catalog = buildPublicCatalog(await listPublicServices(), {
      currency: 'XAF',
      usdXafRate: 1,
      locale: 'fr',
    });
    paths = catalogPaths(catalog.networks);
  } catch {
    // Base injoignable à la construction : on garde les pages fixes.
  }
  return ['', '/services', ...paths].flatMap(entries).slice(0, 50_000);
}
