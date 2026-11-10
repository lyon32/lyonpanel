// Réseaux et types du catalogue public + libellés affichés (jamais le nom du fournisseur).

export const NETWORKS = [
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'telegram',
  'x',
  'kick',
  'threads',
  'twitch',
  'linkedin',
  'pinterest',
  'spotify',
  'whatsapp',
  'discord',
  'soundcloud',
  'web_traffic',
  'other',
] as const;
export type Network = (typeof NETWORKS)[number];

export const SERVICE_TYPES = [
  'followers',
  'likes',
  'views',
  'comments',
  'shares',
  'other',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export type CatalogLocale = 'fr' | 'en';

const BRANDS: Record<Exclude<Network, 'web_traffic' | 'other'>, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  telegram: 'Telegram',
  x: 'X',
  kick: 'Kick',
  threads: 'Threads',
  twitch: 'Twitch',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  spotify: 'Spotify',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  soundcloud: 'SoundCloud',
};

const TYPE_LABELS: Record<ServiceType, Record<CatalogLocale, string>> = {
  followers: { fr: 'Abonnés', en: 'Followers' },
  likes: { fr: "J'aime", en: 'Likes' },
  views: { fr: 'Vues', en: 'Views' },
  comments: { fr: 'Commentaires', en: 'Comments' },
  shares: { fr: 'Partages', en: 'Shares' },
  other: { fr: 'Autres services', en: 'Other services' },
};

export function networkLabel(network: Network, locale: CatalogLocale): string {
  if (network === 'web_traffic') return locale === 'fr' ? 'Trafic web' : 'Web traffic';
  if (network === 'other') return locale === 'fr' ? 'Autres réseaux' : 'Other networks';
  return BRANDS[network];
}

export function typeLabel(type: ServiceType, locale: CatalogLocale): string {
  return TYPE_LABELS[type][locale];
}
