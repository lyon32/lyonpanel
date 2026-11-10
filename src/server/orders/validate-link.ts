import type { Network } from '@/server/catalog/labels';

export type LinkCheck = { ok: true } | { ok: false; reason: 'INVALID_LINK' };

const MAX_LINK_LENGTH = 2048;

// Domaines acceptés par plateforme (le domaine exact ou n'importe quel sous-domaine).
// web_traffic et other : toute adresse http(s) est permise.
const DOMAINS: Partial<Record<Network, string[]>> = {
  tiktok: ['tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
  facebook: ['facebook.com', 'fb.com', 'fb.watch', 'fb.me'],
  youtube: ['youtube.com', 'youtu.be'],
  telegram: ['t.me', 'telegram.me', 'telegram.org'],
  x: ['x.com', 'twitter.com'],
  threads: ['threads.net', 'threads.com'],
  twitch: ['twitch.tv'],
  kick: ['kick.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
  pinterest: ['pinterest.com', 'pin.it'],
  spotify: ['spotify.com', 'spotify.link'],
  whatsapp: ['whatsapp.com', 'wa.me'],
  discord: ['discord.gg', 'discord.com'],
  soundcloud: ['soundcloud.com', 'on.soundcloud.com'],
};

const INVALID: LinkCheck = { ok: false, reason: 'INVALID_LINK' };

/**
 * Vérifie qu'un lien est une adresse http(s) de la bonne plateforme.
 * Le nom d'hôte est comparé exactement (pas de « contient ») pour refuser
 * « nottiktok.com » ou « tiktok.com.evil.example ».
 */
export function validateLink(platform: Network, link: string): LinkCheck {
  const trimmed = link.trim();
  if (trimmed === '' || trimmed.length > MAX_LINK_LENGTH || /\s/.test(trimmed)) return INVALID;

  // Sans schéma, on suppose https. Un « javascript:… » devient alors un hôte invalide.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return INVALID;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return INVALID;
  if (url.username !== '' || url.password !== '' || url.hostname === '') return INVALID;

  const domains = DOMAINS[platform];
  if (!domains) return { ok: true };

  const host = url.hostname.toLowerCase();
  const matches = domains.some((d) => host === d || host.endsWith(`.${d}`));
  return matches ? { ok: true } : INVALID;
}
