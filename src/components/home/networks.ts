// Réseaux de l'accueil : chiffres réels tirés de data/catalogue-resume.json.
// Les réseaux sans service au catalogue (Snapchat, Discord, SoundCloud) n'ont pas de tuile.
import catalogue from '../../../data/catalogue-resume.json';

export const TYPE_KEYS = ['followers', 'likes', 'views', 'comments', 'shares', 'other'] as const;
export type TypeKey = (typeof TYPE_KEYS)[number];

const counts = catalogue.countsByNetworkAndType as Record<string, Partial<Record<string, number>>>;

const LIST = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['facebook', 'Facebook'],
  ['telegram', 'Telegram'],
  ['x', 'X'],
  ['whatsapp', 'WhatsApp'],
  ['spotify', 'Spotify'],
  ['twitch', 'Twitch'],
  ['linkedin', 'LinkedIn'],
] as const;

export const NETWORKS = LIST.map(([id, name]) => {
  const byType = counts[id] ?? {};
  return {
    id,
    name,
    count: Object.values(byType).reduce<number>((s, n) => s + (n ?? 0), 0),
    types: TYPE_KEYS.filter((k) => (byType[k] ?? 0) > 0),
  };
});

export type Net = (typeof NETWORKS)[number];
export const MAIN_NETWORKS = NETWORKS.slice(0, 5);
export const OTHER_NETWORKS = NETWORKS.slice(5);
export const MORE_NAMES = 'Kick, Pinterest, Threads';

export const CATALOGUE_TOTAL = catalogue.total;
