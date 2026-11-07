import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

// Pages publiques indexables seulement (jamais /demo, client ou admin).
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = {
    fr: `${SITE_URL}/fr`,
    en: `${SITE_URL}/en`,
    'x-default': `${SITE_URL}/fr`,
  };
  return [
    { url: `${SITE_URL}/fr`, alternates: { languages } },
    { url: `${SITE_URL}/en`, alternates: { languages } },
  ];
}
