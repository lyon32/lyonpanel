import { SITE_URL } from '@/lib/constants';

export interface ServiceJsonLdInput {
  lang: 'fr' | 'en';
  network: string;
  name: string;
  description: string;
  fromPriceXaf: number;
}

// Prix « dès » en XAF entier : un prix invalide doit faire échouer le rendu, pas tromper Google.
export function buildServiceJsonLd(i: ServiceJsonLdInput) {
  if (!Number.isInteger(i.fromPriceXaf) || i.fromPriceXaf < 0) {
    throw new Error('Prix JSON-LD invalide : entier XAF positif attendu');
  }
  return {
    '@context': 'https://schema.org' as const,
    '@type': 'Service' as const,
    name: i.name,
    description: i.description,
    url: `${SITE_URL}/${i.lang}/services/${i.network}`,
    offers: {
      '@type': 'Offer' as const,
      priceCurrency: 'XAF' as const,
      price: i.fromPriceXaf,
    },
  };
}
