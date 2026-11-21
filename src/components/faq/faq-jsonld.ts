import { escapeJsonLd } from '@/lib/seo/json-ld';

export type FaqItem = { question: string; answer: string };

export type FaqJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: {
    '@type': 'Question';
    name: string;
    acceptedAnswer: { '@type': 'Answer'; text: string };
  }[];
};

// Les moteurs de recherche attendent du texte brut : on retire les balises.
const toPlainText = (s: string) => s.replace(/<[^>]*>/g, '').trim();

export function buildFaqJsonLd(items: FaqItem[]): FaqJsonLd {
  if (items.length === 0) throw new Error('FAQ vide : aucun JSON-LD à produire');
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: toPlainText(i.question),
      acceptedAnswer: { '@type': 'Answer', text: toPlainText(i.answer) },
    })),
  };
}

// Échappement de < partagé avec le composant JsonLd.
export const serializeJsonLd = (ld: FaqJsonLd) => escapeJsonLd(ld);
