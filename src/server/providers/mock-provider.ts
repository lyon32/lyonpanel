import 'server-only';
import type { z } from 'zod';
import mockServices from './mock-services.json';
import { providerServicesSchema, type ProviderApi, type ProviderStatus } from './types';
import { apiError } from '@/server/http/api-error';

export interface MockProviderOptions {
  // Format brut de l'API (rate en texte accepté) : validé par Zod comme une vraie réponse.
  services?: z.input<typeof providerServicesSchema>;
  balanceUsd?: number;
}

// Réglé par la route de test /api/test/provider/fail-next : le prochain `add` échoue, une seule fois.
let failNextAdd = false;
export function armNextAddFailure(): void {
  failNextAdd = true;
}

// Statuts imposés par la route de test force-status (mémoire du module, comme failNextAdd).
const forcedStatuses = new Map<number, 'Partial' | 'Canceled'>();
export function forceMockOrderStatus(
  providerOrderId: number,
  status: 'Partial' | 'Canceled',
): void {
  forcedStatuses.set(providerOrderId, status);
}

const UNLISTED_SERVICE_MIN_ID = 900_000;
const UNLISTED_SERVICE_MAX_QTY = 10_000_000;

/** Faux fournisseur (PROVIDER_MODE=mock) : aucun appel réseau, aucune dépense. */
export function createMockProvider(options: MockProviderOptions = {}): ProviderApi {
  // Instance neuve = état de test neuf : une panne armée plus tôt ne doit pas fuir sur elle.
  failNextAdd = false;
  const catalog = providerServicesSchema.parse(options.services ?? mockServices);
  const balanceUsd = options.balanceUsd ?? 100;
  const orders = new Map<number, ProviderStatus>();
  // Départ lié à l'heure : la base garde les anciens provider_order_id (unicité),
  // un compteur fixe ferait échouer l'enregistrement après un redémarrage.
  let lastOrder = Math.floor(Date.now() / 1000);

  return {
    async services() {
      return structuredClone(catalog);
    },
    async balance() {
      return { balance: balanceUsd, currency: 'USD' };
    },
    async add({ service, quantity }) {
      if (failNextAdd) {
        failNextAdd = false;
        apiError('PROVIDER_ERROR');
      }
      const known = catalog.find((s) => s.service === service);
      // Services seedés (900001+) et de test (9 000 000+) absents du catalogue mock :
      // coût fictif, limite large. Un id bas inconnu reste une erreur.
      const found =
        known ??
        (service >= UNLISTED_SERVICE_MIN_ID
          ? { rate: 1, min: 1, max: UNLISTED_SERVICE_MAX_QTY }
          : undefined);
      if (!found || quantity < found.min || quantity > found.max) apiError('PROVIDER_ERROR');
      lastOrder += 1;
      orders.set(lastOrder, {
        status: 'Pending',
        charge: (found.rate * quantity) / 1000,
        start_count: 0,
        remains: quantity,
        currency: 'USD',
      });
      return { order: lastOrder };
    },
    async status(ids) {
      const out: Record<number, ProviderStatus> = {};
      for (const id of ids) {
        const known = orders.get(id);
        if (!known) continue;
        // Un pas par appel : Pending -> In progress -> Completed (puis reste Completed).
        const forced = forcedStatuses.get(id);
        if (forced) known.status = forced;
        else if (known.status === 'Pending') known.status = 'In progress';
        else if (known.status === 'In progress') {
          known.status = 'Completed';
          known.remains = 0;
        }
        out[id] = { ...known };
      }
      return out;
    },
  };
}
