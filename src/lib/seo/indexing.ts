type Env = Record<string, string | undefined>;

/** Pages privées (espace client, admin, prototypes) : jamais indexées, quelle que soit la variable. */
export const PRIVATE_ROBOTS = { index: false, follow: false } as const;

/**
 * Le site n'est indexable que si SITE_INDEXABLE vaut exactement « true ».
 * Par défaut : non (la bascule se fait à la mise en ligne du domaine).
 */
export function isSiteIndexable(env: Env = process.env): boolean {
  return env.SITE_INDEXABLE === 'true';
}

/** Robots d'une page publique : index/follow seulement quand le site est indexable. */
export function publicRobots(env: Env = process.env): { index: boolean; follow: boolean } {
  const on = isSiteIndexable(env);
  return { index: on, follow: on };
}
