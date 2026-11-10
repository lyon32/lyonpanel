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

/** Faux fournisseur (PROVIDER_MODE=mock) : aucun appel réseau, aucune dépense. */
export function createMockProvider(options: MockProviderOptions = {}): ProviderApi {
  const catalog = providerServicesSchema.parse(options.services ?? mockServices);
  const balanceUsd = options.balanceUsd ?? 100;
  const orders = new Map<number, ProviderStatus>();
  let lastOrder = 10_000;

  return {
    async services() {
      return structuredClone(catalog);
    },
    async balance() {
      return { balance: balanceUsd, currency: 'USD' };
    },
    async add({ service, quantity }) {
      const found = catalog.find((s) => s.service === service);
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
        if (known) out[id] = { ...known };
      }
      return out;
    },
  };
}
