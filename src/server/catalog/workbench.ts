import type { PublicCatalog } from './present-catalog';

/** Service allégé envoyé au navigateur : prix de vente seulement, rien du fournisseur. */
export interface WorkbenchService {
  id: number;
  name: string;
  type: string;
  priceXaf1000: number;
  minQty: number;
  maxQty: number;
  needsComments: boolean;
}

export interface WorkbenchNetwork {
  network: string;
  label: string;
  types: { type: string; label: string }[];
  services: WorkbenchService[];
}

// Un seul booléen par service (commentaires personnalisés) ; le type technique ne sort jamais.
export function toWorkbench(catalog: PublicCatalog, commentIds: Set<number>): WorkbenchNetwork[] {
  return catalog.networks.map((n) => ({
    network: n.network,
    label: n.label,
    types: n.types.map((t) => ({ type: t.type, label: t.label })),
    services: n.types.flatMap((t) =>
      t.services.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        priceXaf1000: s.priceXaf1000,
        minQty: s.minQty,
        maxQty: s.maxQty,
        needsComments: commentIds.has(s.id),
      })),
    ),
  }));
}
