import type { MetadataRoute } from 'next';
import { pathnames } from '@/i18n/routing';
import { SITE_URL } from '@/lib/constants';

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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_DISALLOW }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
