// Les noms de service finissent par « #<numéro> » : on sépare le nom propre du numéro pour l'affichage.
export function splitServiceName(name: string): { title: string; ref: string | null } {
  const match = /^(.*?)\s*#(\d+)\s*$/.exec(name);
  if (!match || !match[1]) return { title: name.trim(), ref: null };
  return { title: match[1], ref: match[2] ?? null };
}
