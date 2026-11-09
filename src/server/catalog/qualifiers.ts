import { normalize } from './classify';
import type { CatalogLocale } from './labels';

// Extrait de courts qualificatifs (cible, qualité, origine, garantie, chute, départ) du nom fournisseur.
// Chaque qualificatif est un mot propre écrit ici en FR/EN : le texte du fournisseur n'est jamais recopié.

type Entry = { re: RegExp; fr: string; en: string };

const TARGETS: Entry[] = [
  { re: /\bstor(y|ies)\b/, fr: 'Story', en: 'Story' },
  { re: /\breels?\b/, fr: 'Reel', en: 'Reel' },
  { re: /\blive\b/, fr: 'Live', en: 'Live' },
  { re: /\bpost\b/, fr: 'Post', en: 'Post' },
  { re: /\bprofile\b/, fr: 'Profil', en: 'Profile' },
  { re: /\bpage\b/, fr: 'Page', en: 'Page' },
];

// Ordre = priorité : le premier qui correspond gagne.
const QUALITIES: Entry[] = [
  { re: /\breal\b/, fr: 'Réel', en: 'Real' },
  { re: /\b(hq|high quality)\b/, fr: 'Haute qualité', en: 'High quality' },
  { re: /\b(premium|vip)\b/, fr: 'Premium', en: 'Premium' },
  { re: /\bmix(ed)?\b(?!\s*countr)/, fr: 'Mixte', en: 'Mixed' },
  { re: /\b(cheap(est)?|budget)\b/, fr: 'Économique', en: 'Budget' },
  { re: /\borganic\b/, fr: 'Organique', en: 'Organic' },
];

// L'origine retenue est celle qui apparaît le plus tôt dans le texte.
const ORIGINS: Entry[] = [
  { re: /\b(usa|united states)\b/, fr: 'États-Unis', en: 'USA' },
  { re: /\b(uk|united kingdom|england)\b/, fr: 'Royaume-Uni', en: 'UK' },
  { re: /\bindia(n)?\b/, fr: 'Inde', en: 'India' },
  { re: /\bturk(ey|ish|iye)\b/, fr: 'Turquie', en: 'Turkey' },
  { re: /\bbrazil(ian)?\b/, fr: 'Brésil', en: 'Brazil' },
  { re: /\bnigeria(n)?\b/, fr: 'Nigeria', en: 'Nigeria' },
  { re: /\bcameroo?n\b/, fr: 'Cameroun', en: 'Cameroon' },
  { re: /\bivory coast\b|\bcote d'?ivoire\b/, fr: "Côte d'Ivoire", en: 'Ivory Coast' },
  { re: /\begypt(ian)?\b/, fr: 'Égypte', en: 'Egypt' },
  { re: /\bghana(ian)?\b/, fr: 'Ghana', en: 'Ghana' },
  { re: /\bkenya(n)?\b/, fr: 'Kenya', en: 'Kenya' },
  { re: /\bmorocc(o|an)\b/, fr: 'Maroc', en: 'Morocco' },
  { re: /\bsouth africa(n)?\b/, fr: 'Afrique du Sud', en: 'South Africa' },
  { re: /\bafrica(n)?\b/, fr: 'Afrique', en: 'Africa' },
  { re: /\beurope(an)?\b/, fr: 'Europe', en: 'Europe' },
  {
    re: /\b(middle east|arab(ic|ian|s)?|saudi\s?arabia)\b/,
    fr: 'Pays arabes',
    en: 'Arab countries',
  },
];

const WORLDWIDE: Entry = {
  re: /\b(worldwide|global|mix(ed)? countr\w+)\b/,
  fr: 'Mondial',
  en: 'Worldwide',
};

function firstOrigin(text: string): Entry | null {
  let best: { index: number; entry: Entry } | null = null;
  for (const entry of ORIGINS) {
    const index = text.search(entry.re);
    if (index >= 0 && (best === null || index < best.index)) best = { index, entry };
  }
  return best ? best.entry : null;
}

function findEntry(text: string, entries: Entry[]): Entry | null {
  return entries.find((e) => e.re.test(text)) ?? null;
}

// Durée de garantie en jours, ou 'life'. « No Refill » seul ne donne rien.
function guarantee(text: string): number | 'life' | null {
  if (/\b(life\s?time|forever|permanent)\b/.test(text)) return 'life';
  const hasRefillWord = /refill|guarant|♻/.test(text);
  const match =
    /\brefill:?\s*(\d{1,3})\s*-?\s*(?:days?|d)\b/.exec(text) ??
    (hasRefillWord
      ? /\b(\d{1,3})\s*-?\s*(?:days?\b|d\b(?=\s*(?:refill|guarant)))/.exec(text)
      : null) ??
    /\br(\d{1,3})\b/.exec(text);
  return match ? Number(match[1]) : null;
}

export function extractQualifiers(
  providerName: string | undefined,
  providerCategory: string | undefined,
  locale: CatalogLocale,
): string[] {
  const text = normalize(providerName ?? '');
  const category = normalize(providerCategory ?? '');
  const fr = locale === 'fr';
  const label = (e: Entry | null): string[] => (e ? [fr ? e.fr : e.en] : []);

  const origin =
    firstOrigin(text) ??
    (WORLDWIDE.re.test(text) ? WORLDWIDE : null) ??
    firstOrigin(category) ??
    (WORLDWIDE.re.test(category) ? WORLDWIDE : null);

  const days = guarantee(text);
  const guaranteeLabel =
    days === null
      ? []
      : days === 'life'
        ? [fr ? 'Garantie à vie' : 'Lifetime refill']
        : [fr ? `Garantie ${days} j` : `${days}-day refill`];

  const drop = /\b(non|no)[\s-]?drop\b|\b0\s?%\s*drop\b|\bdrop\s*0\s?%|\bzero drop\b/.test(text)
    ? [fr ? 'Sans chute' : 'No drop']
    : /\blow drops?\b/.test(text)
      ? [fr ? 'Chute faible' : 'Low drop']
      : [];
  const instant = /\binstant\b/.test(text) ? [fr ? 'Départ instantané' : 'Instant start'] : [];

  return [
    ...label(findEntry(text, TARGETS)),
    ...label(findEntry(text, QUALITIES)),
    ...label(origin),
    ...guaranteeLabel,
    ...drop,
    ...instant,
  ].slice(0, 4);
}
