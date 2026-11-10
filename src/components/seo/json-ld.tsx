// Données structurées : le JSON est écrit tel quel dans la balise script.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}
