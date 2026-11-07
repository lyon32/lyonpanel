// Réseaux du catalogue (docs/01 §2). Logos : simple-icons (CC0) dans public/brand/networks/.
// « web » n'a pas de logo de marque : icône Lucide neutre dans NetworkLogo.
export const NETWORKS = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'x', name: 'X (Twitter)' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'snapchat', name: 'Snapchat' },
  { id: 'twitch', name: 'Twitch' },
  { id: 'soundcloud', name: 'SoundCloud' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'discord', name: 'Discord' },
  { id: 'web', name: null },
] as const;

export type NetworkId = (typeof NETWORKS)[number]['id'];
