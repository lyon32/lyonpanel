// Réseaux qui méritent une page propre ; les autres restent dans « Autres réseaux ».
export const RICH_NETWORKS = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'telegram',
  'x',
] as const;
export type RichNetwork = (typeof RICH_NETWORKS)[number];

// Sous ce nombre de services, la page serait trop mince pour être utile.
export const MIN_SERVICES_FOR_PAGE = 10;

export const isRichNetwork = (network: string, serviceCount: number): boolean =>
  (RICH_NETWORKS as readonly string[]).includes(network) && serviceCount >= MIN_SERVICES_FOR_PAGE;

// Prix affiché « dès » : le plus petit prix réel, jamais un prix inventé.
export function fromPriceXaf(services: { priceXaf1000: number }[]): number | null {
  if (services.length === 0) return null;
  return Math.min(...services.map((s) => s.priceXaf1000));
}

interface NetworkLike {
  network: string;
  types: { services: unknown[] }[];
}

export const countServices = (n: NetworkLike): number =>
  n.types.reduce((sum, t) => sum + t.services.length, 0);

export function splitNetworks<T extends NetworkLike>(networks: T[]): { rich: T[]; others: T[] } {
  const rich: T[] = [];
  const others: T[] = [];
  for (const n of networks) (isRichNetwork(n.network, countServices(n)) ? rich : others).push(n);
  return { rich, others };
}
