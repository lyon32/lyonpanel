/**
 * Numéro de page à afficher et adresse canonique. `canonical` est faux quand l'adresse demandée
 * est un doublon (page=0, abc, 1.5, 06, page 1 écrite, page après la dernière) : la page redirige.
 */
export function resolvePage(
  raw: string | undefined,
  totalPages: number,
): { page: number; canonical: boolean } {
  if (raw === undefined) return { page: 1, canonical: true };
  const valid = /^[1-9]\d{0,8}$/.test(raw);
  const page = valid ? Math.min(Number(raw), totalPages) : 1;
  // La page 1 s'écrit sans paramètre.
  return { page, canonical: valid && page === Number(raw) && page > 1 };
}
