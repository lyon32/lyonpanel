import type { RawProviderService } from '../helpers/provider-fixture';

let nextId = 700_000;

/** Service au format API v2 du fournisseur (sans base). Id unique par appel. */
export function makeProviderService(
  overrides: Partial<RawProviderService> = {},
): RawProviderService {
  nextId += 1;
  return {
    service: nextId,
    name: 'TikTok - Followers | MQ 100K | R30',
    type: 'Default',
    rate: '1.50',
    min: 10,
    max: 100000,
    dripfeed: false,
    refill: true,
    cancel: false,
    category: 'TikTok - Followers',
    ...overrides,
  };
}
