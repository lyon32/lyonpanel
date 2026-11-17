import type { NameableService } from './build-name';
import { networkLabel, typeLabel, type CatalogLocale } from './labels';
import { extractFacts, shortQty, type Facts } from './qualifiers';

const MAX_LENGTH = 400;

// Séparateur de milliers : espace insécable en français, virgule en anglais.
function formatQty(n: number, locale: CatalogLocale): string {
  const sep = locale === 'fr' ? ' ' : ',';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function rangeSentence(service: NameableService, facts: Facts, locale: CatalogLocale): string {
  const fr = locale === 'fr';
  // Le « Max » annoncé remplace le maximum technique quand il est plus bas (souvent 2 milliards).
  const max =
    facts.announcedMax !== null && facts.announcedMax < service.max_qty
      ? facts.announcedMax
      : service.max_qty;
  const min = formatQty(service.min_qty, locale);
  if (service.min_qty === max) return fr ? `Quantité : ${min}.` : `Quantity: ${min}.`;
  const top = formatQty(max, locale);
  return fr ? `Commande de ${min} à ${top}.` : `Order from ${min} to ${top}.`;
}

function guaranteeSentence(facts: Facts, fr: boolean): string[] {
  const g = facts.guarantee;
  if (g === null) return [];
  if (g === 'life') return [fr ? 'Garantie à vie.' : 'Refill guarantee for life.'];
  return [fr ? `Garantie de ${g} jours.` : `Refill guarantee: ${g} days.`];
}

function dropSentence(facts: Facts, fr: boolean): string[] {
  const d = facts.drop;
  if (!d) return [];
  if (d.kind === 'none') return [fr ? 'Sans chute.' : 'No drop.'];
  if (d.kind === 'low') return [fr ? 'Chute faible.' : 'Low drop.'];
  return [fr ? `Chute annoncée : ${d.pct} %.` : `Expected drop: ${d.pct}%.`];
}

function startSentence(facts: Facts, fr: boolean): string[] {
  const parts: string[] = [];
  if (facts.instant) parts.push(fr ? 'Démarrage instantané' : 'Starts instantly');
  if (facts.speed) {
    const amount = shortQty(facts.speed.amount);
    const day = facts.speed.per === 'day';
    parts.push(
      fr
        ? `jusqu'à ${amount} par ${day ? 'jour' : 'heure'}`
        : `up to ${amount} per ${day ? 'day' : 'hour'}`,
    );
  }
  if (parts.length === 0) return [];
  const text = parts.join(', ');
  return [`${text.charAt(0).toUpperCase()}${text.slice(1)}.`];
}

function optionsSentence(service: NameableService, fr: boolean): string[] {
  const options = [
    service.refill ? (fr ? 'recharge' : 'refill') : null,
    service.cancel ? (fr ? 'annulation' : 'cancellation') : null,
    service.dripfeed ? (fr ? 'goutte-à-goutte' : 'drip-feed') : null,
  ].filter((o): o is string => o !== null);
  if (options.length === 0) return [];
  return [`${fr ? 'Options :' : 'Options:'} ${options.join(', ')}.`];
}

// Description écrite par nous, à partir de faits relevés dans le nom fournisseur et des champs du service.
// Aucune phrase du fournisseur n'est recopiée.
export function buildServiceDescription(service: NameableService, locale: CatalogLocale): string {
  const fr = locale === 'fr';
  const facts = extractFacts(service.providerName, service.providerCategory);
  const head = `${typeLabel(service.category, locale)} ${networkLabel(service.platform, locale)}`;
  const target = facts.target ? (fr ? facts.target.fr : facts.target.en) : null;

  const who: string[] = [];
  if (facts.quality)
    who.push(
      fr ? (facts.quality.dfr ?? facts.quality.fr) : (facts.quality.den ?? facts.quality.en),
    );
  if (facts.origin) {
    const origin = fr
      ? (facts.origin.dfr ?? facts.origin.fr)
      : (facts.origin.den ?? facts.origin.en);
    who.push(fr ? `origine ${origin}` : `origin: ${origin}`);
  }
  if (facts.male) who.push(fr ? 'profils masculins' : 'male profiles');
  const whoText = who.join(', ');

  const required = [`${head}${target ? ` (${target})` : ''}.`];
  const range = rangeSentence(service, facts, locale);
  // Du plus important au moins important : on retire par la fin si le texte dépasse la limite.
  const optional = [
    ...(who.length > 0 ? [`${whoText.charAt(0).toUpperCase()}${whoText.slice(1)}.`] : []),
    ...guaranteeSentence(facts, fr),
    ...dropSentence(facts, fr),
    ...startSentence(facts, fr),
    ...(facts.minutes
      ? [fr ? `Durée : ${facts.minutes} minutes.` : `Duration: ${facts.minutes} minutes.`]
      : []),
    ...optionsSentence(service, fr),
  ];

  const compose = () => [...required, ...optional, range].join(' ');
  while (optional.length > 0 && compose().length > MAX_LENGTH) optional.pop();
  return compose();
}
