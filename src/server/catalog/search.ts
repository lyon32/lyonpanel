import { normalize } from '@/server/catalog/classify';

const MAX_QUERY = 60;

// Minuscules, sans accents, sans ponctuation : « J'aime » et « jaime » deviennent identiques.
export function foldForSearch(text: string): string {
  return normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Recherche en mémoire (jamais dans une requête SQL) : nom du service ou numéro exact. */
export function searchServices<T extends { id: number; name: string }>(
  services: T[],
  query: string,
): T[] {
  const needle = foldForSearch(query.slice(0, MAX_QUERY));
  if (!needle) return services;
  return services.filter((s) => foldForSearch(s.name).includes(needle) || String(s.id) === needle);
}
