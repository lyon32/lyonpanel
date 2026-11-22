import { escapeJsonLd } from '@/lib/seo/json-ld';

// Données structurées : le JSON est écrit dans la balise script, avec « < » échappé.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json">{escapeJsonLd(data)}</script>;
}
