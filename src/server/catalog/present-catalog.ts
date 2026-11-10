import { buildServiceName } from '@/server/catalog/build-name';
import {
  NETWORKS,
  SERVICE_TYPES,
  networkLabel,
  typeLabel,
  type CatalogLocale,
  type Network,
  type ServiceType,
} from '@/server/catalog/labels';
import type { PublicServiceRow } from '@/server/catalog/public-catalog';
import { computeMinOrderXaf } from '@/server/pricing/compute-price';
import type { Currency } from '@/lib/currency';
import { convertFromXaf } from '@/lib/money';

/** Seul format qui sort vers le navigateur : liste blanche de champs, construite champ par champ. */
export interface PublicService {
  id: number;
  name: string;
  network: Network;
  type: ServiceType;
  priceXaf1000: number;
  minQty: number;
  maxQty: number;
  minOrderXaf: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  displayPrice1000: number;
  displayMinOrder: number;
}

export interface PublicCatalog {
  currency: Currency;
  locale: CatalogLocale;
  networks: {
    network: Network;
    label: string;
    types: { type: ServiceType; label: string; services: PublicService[] }[];
  }[];
}

const asNetwork = (v: string): Network => NETWORKS.find((n) => n === v) ?? 'other';
const asType = (v: string): ServiceType => SERVICE_TYPES.find((t) => t === v) ?? 'other';

export function toPublicService(
  row: PublicServiceRow,
  opts: { currency: Currency; locale: CatalogLocale; usdXafRate: number },
): PublicService {
  const network = asNetwork(row.platform);
  const type = asType(row.category);
  const minOrderXaf = computeMinOrderXaf(row.price_xaf_1000, row.min_qty);
  return {
    id: row.id,
    name: buildServiceName({ ...row, platform: network, category: type }, opts.locale),
    network,
    type,
    priceXaf1000: row.price_xaf_1000,
    minQty: row.min_qty,
    maxQty: row.max_qty,
    minOrderXaf,
    refill: row.refill,
    cancel: row.cancel,
    dripfeed: row.dripfeed,
    displayPrice1000: convertFromXaf(row.price_xaf_1000, opts.currency, opts.usdXafRate),
    displayMinOrder: convertFromXaf(minOrderXaf, opts.currency, opts.usdXafRate),
  };
}

/** Groupe réseau -> type, dans l'ordre des listes NETWORKS / SERVICE_TYPES ; les groupes vides sont omis. */
export function buildPublicCatalog(
  rows: PublicServiceRow[],
  opts: { currency: Currency; locale: CatalogLocale; usdXafRate: number },
): PublicCatalog {
  const services = rows.map((r) => toPublicService(r, opts));
  const networks = NETWORKS.map((network) => ({
    network,
    label: networkLabel(network, opts.locale),
    types: SERVICE_TYPES.map((type) => ({
      type,
      label: typeLabel(type, opts.locale),
      services: services.filter((s) => s.network === network && s.type === type),
    })).filter((t) => t.services.length > 0),
  })).filter((n) => n.types.length > 0);
  return { currency: opts.currency, locale: opts.locale, networks };
}
