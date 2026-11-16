import { NETWORKS, SERVICE_TYPES, type Network, type ServiceType } from './labels';
import type { PublicCatalog, PublicService } from './present-catalog';
import { resolvePage } from './resolve-page';
import { searchServices } from './search';

export const PICKER_PAGE_SIZE = 30;

export interface PickerParams {
  network?: string;
  type?: string;
  q?: string;
  page?: string;
}

export interface PickerView {
  network: Network | null;
  type: ServiceType | null;
  q: string;
  page: number;
  totalPages: number;
  total: number;
  networks: { network: Network; label: string; count: number }[];
  types: { type: ServiceType; label: string; count: number }[];
  services: PublicService[];
}

// Un paramètre inconnu est ignoré (jamais d'erreur) : le client retombe sur la liste des réseaux.
export function buildPicker(catalog: PublicCatalog, params: PickerParams): PickerView {
  const network = NETWORKS.find((n) => n === params.network) ?? null;
  const type = SERVICE_TYPES.find((t) => t === params.type) ?? null;
  const q = (params.q ?? '').trim().slice(0, 60);

  const networks = catalog.networks.map((n) => ({
    network: n.network,
    label: n.label,
    count: n.types.reduce((sum, t) => sum + t.services.length, 0),
  }));
  const entry = network ? catalog.networks.find((n) => n.network === network) : undefined;
  const types = (entry?.types ?? []).map((t) => ({
    type: t.type,
    label: t.label,
    count: t.services.length,
  }));

  // Sans réseau ni recherche : on montre seulement les réseaux, pas 3 000 lignes.
  const browsing = network !== null || q !== '';
  const pool = (entry ? [entry] : catalog.networks)
    .flatMap((n) => n.types)
    .filter((t) => type === null || t.type === type)
    .flatMap((t) => t.services);
  const matches = browsing ? searchServices(pool, q) : [];

  const totalPages = Math.max(1, Math.ceil(matches.length / PICKER_PAGE_SIZE));
  const { page } = resolvePage(params.page, totalPages);
  return {
    network,
    type,
    q,
    page,
    totalPages,
    total: matches.length,
    networks,
    types,
    services: matches.slice((page - 1) * PICKER_PAGE_SIZE, page * PICKER_PAGE_SIZE),
  };
}
