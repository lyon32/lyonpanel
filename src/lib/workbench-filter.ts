// Filtre du choix de service (côté navigateur). Une version « pliée » du texte : minuscules, sans
// accents ni ponctuation, comme la recherche du catalogue public (server/catalog/search.ts).
export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Filterable {
  id: number;
  name: string;
  type: string;
}

export const MAX_OPTIONS = 300;

/** Services du type choisi (vide = tous) dont le nom ou le numéro contient la recherche. */
export function filterServices<T extends Filterable>(
  services: T[],
  type: string,
  query: string,
): T[] {
  const needle = foldText(query.slice(0, 60));
  return services.filter(
    (s) =>
      (type === '' || s.type === type) &&
      (needle === '' || foldText(s.name).includes(needle) || String(s.id) === needle),
  );
}
