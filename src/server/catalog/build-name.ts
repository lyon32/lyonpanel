import {
  networkLabel,
  typeLabel,
  type CatalogLocale,
  type Network,
  type ServiceType,
} from './labels';
import { extractQualifiers } from './qualifiers';

export type NameableService = {
  id: number;
  platform: Network;
  category: ServiceType;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  min_qty: number;
  max_qty: number;
  // Entrées serveur seulement : sert à trouver des qualificatifs, jamais recopié ni renvoyé.
  providerName?: string;
  providerCategory?: string;
};

const FLAGS: Record<CatalogLocale, { refill: string; cancel: string; dripfeed: string }> = {
  fr: { refill: 'Recharge', cancel: 'Annulable', dripfeed: 'Goutte-à-goutte' },
  en: { refill: 'Refill', cancel: 'Cancellable', dripfeed: 'Drip-feed' },
};

const MAX_LEN = 95;

function parts(service: NameableService, locale: CatalogLocale) {
  const flags = FLAGS[locale];
  const head = `${typeLabel(service.category, locale)} ${networkLabel(service.platform, locale)}`;
  const qualifiers = extractQualifiers(
    service.providerName,
    service.providerCategory,
    locale,
    service.max_qty,
  );
  const options = [
    service.refill ? flags.refill : null,
    service.cancel ? flags.cancel : null,
    service.dripfeed ? flags.dripfeed : null,
  ].filter((o): o is string => o !== null);
  return { head, qualifiers, options };
}

// Le nom est reconstruit depuis des champs propres : le nom du fournisseur n'est jamais repris.
// Au plus 95 caractères avant « #id ». Les listes FR et EN ont les mêmes qualificatifs dans le même
// ordre : on retire les derniers dans les DEUX langues dès qu'une des deux est trop longue,
// pour que les noms FR et EN disent la même chose.
export function buildServiceName(service: NameableService, locale: CatalogLocale): string {
  const fr = parts(service, 'fr');
  const en = parts(service, 'en');
  const length = (p: typeof fr) => [p.head, ...p.qualifiers, ...p.options].join(' · ').length;
  let keep = Math.min(fr.qualifiers.length, en.qualifiers.length);
  while (
    keep > 0 &&
    (length({ ...fr, qualifiers: fr.qualifiers.slice(0, keep) }) > MAX_LEN ||
      length({ ...en, qualifiers: en.qualifiers.slice(0, keep) }) > MAX_LEN)
  )
    keep -= 1;
  const p = locale === 'fr' ? fr : en;
  return `${[p.head, ...p.qualifiers.slice(0, keep), ...p.options].join(' · ')} #${service.id}`;
}
