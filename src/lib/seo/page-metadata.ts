import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/constants';
import { publicRobots } from '@/lib/seo/indexing';
import { getSiteUrl } from '@/lib/seo/site-url';

type Lang = 'fr' | 'en';
type Env = Record<string, string | undefined>;

const OG_LOCALE: Record<Lang, string> = { fr: 'fr_FR', en: 'en_US' };
// Image de partage par défaut (1200×630), à fournir dans public/og/.
export const DEFAULT_OG_IMAGE = '/og/default.png';

export interface PageMetaInput {
  lang: Lang;
  /** Chemin sans langue ni paramètre, ex. `/services/tiktok` ; `''` pour l'accueil. */
  path: string;
  title: string;
  description: string;
  /** Chemin ou URL absolue d'une image 1200×630. */
  ogImage?: string;
}

/** Métadonnées complètes d'une page publique ; refuse un titre ou une description hors règles. */
export function buildPageMetadata(
  { lang, path, title, description, ogImage = DEFAULT_OG_IMAGE }: PageMetaInput,
  env: Env = process.env,
): Metadata {
  if (title.length > 60) throw new Error(`Titre trop long (${title.length} > 60) : ${title}`);
  if (!title.includes(SITE_NAME))
    throw new Error(`Le titre doit contenir « ${SITE_NAME} » : ${title}`);
  if (description.length < 70 || description.length > 160) {
    throw new Error(`Description hors 70-160 caractères (${description.length}) : ${title}`);
  }
  const site = getSiteUrl(env);
  const url = (l: Lang) => `${site}/${l}${path}`;
  const image = /^https?:\/\//.test(ogImage) ? ogImage : `${site}${ogImage}`;
  return {
    title,
    description,
    robots: publicRobots(env),
    alternates: {
      canonical: url(lang),
      languages: { fr: url('fr'), en: url('en'), 'x-default': url('fr') },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: url(lang),
      siteName: SITE_NAME,
      locale: OG_LOCALE[lang],
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
