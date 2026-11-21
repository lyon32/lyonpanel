import type { MetadataRoute } from 'next';
import { pathnames } from '@/i18n/routing';
import { isSiteIndexable } from '@/lib/seo/indexing';
import { getSiteUrl } from '@/lib/seo/site-url';

// Pages client (LLD §6) : interdites en FR et EN.
const PRIVATE_KEYS = [
  '/dashboard',
  '/order',
  '/orders',
  '/add-funds',
  '/transactions',
  '/favorites',
  '/tickets',
  '/referral',
  '/account',
] as const;

export const PRIVATE_DISALLOW = [
  '/api/',
  ...PRIVATE_KEYS.flatMap((key) => [`/fr${pathnames[key].fr}`, `/en${pathnames[key].en}`]),
];

// Tant que SITE_INDEXABLE n'est pas « true » : tout est interdit et aucun sitemap n'est annoncé.
// L'adresse admin n'apparaît jamais ici.
export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexable()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_DISALLOW }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
