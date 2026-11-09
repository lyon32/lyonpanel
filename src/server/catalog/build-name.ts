import {
  networkLabel,
  typeLabel,
  type CatalogLocale,
  type Network,
  type ServiceType,
} from './labels';

export type NameableService = {
  id: number;
  platform: Network;
  category: ServiceType;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  min_qty: number;
  max_qty: number;
};

const FLAGS: Record<CatalogLocale, { refill: string; cancel: string; dripfeed: string }> = {
  fr: { refill: 'Recharge', cancel: 'Annulable', dripfeed: 'Goutte-à-goutte' },
  en: { refill: 'Refill', cancel: 'Cancellable', dripfeed: 'Drip-feed' },
};

// Le nom est reconstruit depuis des champs propres : le nom du fournisseur n'est jamais repris.
export function buildServiceName(service: NameableService, locale: CatalogLocale): string {
  const flags = FLAGS[locale];
  const head = `${typeLabel(service.category, locale)} ${networkLabel(service.platform, locale)}`;
  const options = [
    service.refill ? flags.refill : null,
    service.cancel ? flags.cancel : null,
    service.dripfeed ? flags.dripfeed : null,
  ].filter((o): o is string => o !== null);
  return `${[head, ...options].join(' · ')} #${service.id}`;
}
