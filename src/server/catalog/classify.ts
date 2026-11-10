import type { Network, ServiceType } from './labels';

// Normalise : lettres stylisées et pleine chasse -> ASCII (NFKD), marques retirées, minuscules.
export function normalize(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

const NETWORK_PATTERNS: [Network, RegExp][] = [
  ['instagram', /\b(instagram|insta|ig)\b/],
  ['tiktok', /\btik\s?tok\b/],
  ['facebook', /\b(facebook|fb)\b/],
  ['youtube', /\b(youtube|yt)\b/],
  ['telegram', /\btelegram\b/],
  ['x', /\b(x|twitter)\b/],
  ['kick', /\bkick\b/],
  ['threads', /\bthreads\b/],
  ['twitch', /\btwitch\b/],
  ['linkedin', /\blinked\s?in\b/],
  ['pinterest', /\bpinterest\b/],
  ['spotify', /\bspotify\b/],
  ['whatsapp', /\bwhats\s?app\b/],
  ['discord', /\bdiscord\b/],
  ['soundcloud', /\bsound\s?cloud\b/],
  ['web_traffic', /\bweb(site)?\b[\s-]*traffic\b/],
];

// Le mot-clé qui apparaît le plus tôt dans le texte gagne.
function firstMatch<T extends string>(text: string, patterns: [T, RegExp][]): T | null {
  let best: { value: T; index: number } | null = null;
  for (const [value, re] of patterns) {
    const index = text.search(re);
    if (index >= 0 && (best === null || index < best.index)) best = { value, index };
  }
  return best ? best.value : null;
}

export function classifyNetwork(name: string, providerCategory: string): Network {
  return (
    firstMatch(normalize(name), NETWORK_PATTERNS) ??
    firstMatch(normalize(providerCategory), NETWORK_PATTERNS) ??
    'other'
  );
}

const TYPE_PATTERNS: [ServiceType, RegExp][] = [
  ['followers', /\b(followers?|subscri\w*|members?)\b/],
  ['likes', /\blikes?\b/],
  ['views', /\b(views?|viewers?|plays?|watch\s?time)\b/],
  ['comments', /\bcomments?\b/],
  ['shares', /\b(shares?|reposts?|reshares?|saves?)\b/],
];

export function classifyType(name: string, providerType: string): ServiceType {
  const type = normalize(providerType).trim();
  // Ces deux types fournisseur sont fiables : ils priment sur les mots du nom.
  if (type === 'custom comments') return 'comments';
  if (type === 'comment likes') return 'likes';
  return firstMatch(normalize(name), TYPE_PATTERNS) ?? 'other';
}
