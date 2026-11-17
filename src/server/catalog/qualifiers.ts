import { normalize } from './classify';
import type { CatalogLocale } from './labels';

// Extrait des faits (cible, qualité, origine, garantie, chute, départ, vitesse, maximum) du nom fournisseur.
// Chaque libellé est écrit ici en FR/EN : le texte du fournisseur n'est jamais recopié.

// dfr / den : formulation pour les phrases de description (sinon fr / en).
export type Entry = { re: RegExp; fr: string; en: string; dfr?: string; den?: string };

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
  { re: /\breal\b/, fr: 'Réel', en: 'Real', dfr: 'Comptes réels', den: 'Genuine accounts' },
  {
    re: /\b(hq|high quality)\b/,
    fr: 'Haute qualité',
    en: 'High quality',
    dfr: 'Haute qualité',
    den: 'High quality',
  },
  {
    re: /\b(premium|vip)\b/,
    fr: 'Premium',
    en: 'Premium',
    dfr: 'Qualité premium',
    den: 'Premium service',
  },
  {
    re: /\bmix(ed)?\b(?!\s*countr)/,
    fr: 'Mixte',
    en: 'Mixed',
    dfr: 'Profils variés',
    den: 'Varied profiles',
  },
  {
    re: /\b(cheap(est)?|budget)\b/,
    fr: 'Économique',
    en: 'Budget',
    dfr: 'Qualité économique',
    den: 'Low-cost service',
  },
  {
    re: /\borganic\b/,
    fr: 'Organique',
    en: 'Organic',
    dfr: 'Croissance organique',
    den: 'Natural growth',
  },
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
  { re: /\bitaly\b|\bitalian\b/, fr: 'Italie', en: 'Italy' },
  { re: /\b(china|chinese)\b/, fr: 'Chine', en: 'China' },
  { re: /\b(korea|korean)\b/, fr: 'Corée', en: 'Korea' },
  { re: /\b(japan|japanese)\b/, fr: 'Japon', en: 'Japan' },
  { re: /\b(germany|german)\b/, fr: 'Allemagne', en: 'Germany' },
  { re: /\b(france|french)\b/, fr: 'France', en: 'France' },
  { re: /\b(spain|spanish)\b/, fr: 'Espagne', en: 'Spain' },
  { re: /\brussia(n)?\b/, fr: 'Russie', en: 'Russia' },
  { re: /\bindonesia(n)?\b/, fr: 'Indonésie', en: 'Indonesia' },
  { re: /\bpakistan(i)?\b/, fr: 'Pakistan', en: 'Pakistan' },
  { re: /\bmexic(o|an)\b/, fr: 'Mexique', en: 'Mexico' },
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
  dfr: 'mondiale',
  den: 'worldwide',
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

// « 50K » -> 50 000, « 5M » -> 5 000 000.
function parseAmount(num: string, unit: string | undefined): number {
  const n = Number(num.replace(',', '.'));
  const factor = unit === 'k' ? 1000 : unit === 'm' ? 1_000_000 : 1;
  return Math.round(n * factor);
}

const MAX_DAILY_SPEED = 10_000_000;

export type Speed = { amount: number; per: 'day' | 'hour' };

// Vitesse annoncée : « Day 100K », « Speed: 500K/Day », « 1K/D », « 10-20K/D », « 1500/Hours ».
// Pour une plage, on garde la borne haute (le nombre juste avant la barre).
function extractSpeed(text: string): Speed | null {
  const daily =
    /\bday\s*(\d+(?:[.,]\d+)?)\s*(k|m)\b/.exec(text) ??
    /(\d+(?:[.,]\d+)?)\s*(k|m)?\+?\s*(?:p\s*)?\/\s*(?:d|day|days)\b/.exec(text) ??
    /(\d+(?:[.,]\d+)?)\s*(k|m)?\s*(?:per\s*day|daily)\b/.exec(text);
  if (daily) {
    const amount = parseAmount(daily[1] ?? '0', daily[2]);
    // Au-delà de 10M par jour, c'est du marketing : on n'affiche rien plutôt qu'une promesse fausse.
    if (amount >= 10 && amount <= MAX_DAILY_SPEED) return { amount, per: 'day' };
  }
  const hourly = /(\d+(?:[.,]\d+)?)\s*(k|m)?\+?\s*\/\s*(?:h|hr|hour|hours)\b/.exec(text);
  if (hourly) {
    const amount = parseAmount(hourly[1] ?? '0', hourly[2]);
    if (amount >= 10) return { amount, per: 'hour' };
  }
  return null;
}

// Maximum annoncé (« Max 5M », « Max 50K ») ; peut différer du maximum technique.
function extractAnnouncedMax(text: string): number | null {
  const m = /\bmax\.?\s*(\d+(?:[.,]\d+)?)\s*(k|m)\b/.exec(text);
  return m ? parseAmount(m[1] ?? '0', m[2]) : null;
}

/** 50000 -> « 50K », 5000000 -> « 5M », 1500 -> « 1500 ». */
export function shortQty(n: number): string {
  if (n >= 1_000_000 && n % 100_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}K`;
  return String(n);
}

export type Drop = { kind: 'none' } | { kind: 'low' } | { kind: 'pct'; pct: string };

export interface Facts {
  target: Entry | null;
  quality: Entry | null;
  origin: Entry | null;
  guarantee: number | 'life' | null;
  drop: Drop | null;
  instant: boolean;
  speed: Speed | null;
  minutes: string | null;
  male: boolean;
  announcedMax: number | null;
}

function dropFact(text: string): Drop | null {
  if (/\b(non|no)[\s-]?drop\b|\b0\s?%\s*drop\b|\bdrop\s*0\s?%|\bzero drop\b/.test(text))
    return { kind: 'none' };
  if (/\blow drops?\b/.test(text)) return { kind: 'low' };
  const pct = /\bdrop\s*(\d{1,2}(?:-\d{1,2})?)\s?%|\b(\d{1,2}(?:-\d{1,2})?)\s?%\s*drop\b/.exec(
    text,
  );
  return pct ? { kind: 'pct', pct: pct[1] ?? pct[2] ?? '' } : null;
}

// Durée de service (vues, live) seulement. « 1 Minutes Completed » est un temps de fin
// de commande : sur des abonnés, l'afficher comme « 1 min » tromperait le client.
function extractMinutes(text: string): string | null {
  if (!/\b(views?|viewers?|watch\w*|live)\b/.test(text)) return null;
  const m = /(\d+(?:-\d+)?)\s*(?:minutes?|mins?)\b(?!\s*(?:completed|start|delivery))/.exec(text);
  return m?.[1] ?? null;
}

export function extractFacts(
  providerName: string | undefined,
  providerCategory: string | undefined,
): Facts {
  const text = normalize(providerName ?? '');
  const category = normalize(providerCategory ?? '');
  return {
    target: findEntry(text, TARGETS),
    quality: findEntry(text, QUALITIES),
    origin:
      firstOrigin(text) ??
      (WORLDWIDE.re.test(text) ? WORLDWIDE : null) ??
      firstOrigin(category) ??
      (WORLDWIDE.re.test(category) ? WORLDWIDE : null),
    guarantee: guarantee(text),
    drop: dropFact(text),
    instant: /\binstant\b/.test(text),
    speed: extractSpeed(text),
    minutes: extractMinutes(text),
    male: /\bmale\b/.test(text) && !/\bfemale\b/.test(text),
    announcedMax: extractAnnouncedMax(text),
  };
}

// Qualificatifs courts du nom. Les six premières familles (4 au plus) gardent leur ordre ;
// vitesse et maximum annoncé viennent ensuite pour distinguer deux services proches.
export function extractQualifiers(
  providerName: string | undefined,
  providerCategory: string | undefined,
  locale: CatalogLocale,
  technicalMax?: number,
): string[] {
  const f = extractFacts(providerName, providerCategory);
  const fr = locale === 'fr';
  const label = (e: Entry | null): string[] => (e ? [fr ? e.fr : e.en] : []);

  const guaranteeLabel =
    f.guarantee === null
      ? []
      : f.guarantee === 'life'
        ? [fr ? 'Garantie à vie' : 'Lifetime refill']
        : [fr ? `Garantie ${f.guarantee} j` : `${f.guarantee}-day refill`];
  const drop = !f.drop
    ? []
    : f.drop.kind === 'none'
      ? [fr ? 'Sans chute' : 'No drop']
      : f.drop.kind === 'low'
        ? [fr ? 'Chute faible' : 'Low drop']
        : [fr ? `Chute ${f.drop.pct} %` : `${f.drop.pct}% drop`];
  const instant = f.instant ? [fr ? 'Départ instantané' : 'Instant start'] : [];
  const speed = f.speed
    ? [
        `${shortQty(f.speed.amount)}/${fr ? (f.speed.per === 'day' ? 'jour' : 'heure') : f.speed.per}`,
      ]
    : [];
  const announced =
    f.announcedMax !== null && f.announcedMax !== technicalMax
      ? [`Max ${shortQty(f.announcedMax)}`]
      : [];

  return [
    ...[
      ...label(f.target),
      ...label(f.quality),
      ...label(f.origin),
      ...guaranteeLabel,
      ...drop,
      ...instant,
    ].slice(0, 4),
    ...speed,
    ...(f.minutes ? [`${f.minutes} min`] : []),
    ...(f.male ? [fr ? 'Hommes' : 'Male'] : []),
    ...announced,
  ];
}
