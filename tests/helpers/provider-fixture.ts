import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Un service tel que l'API v2 du fournisseur le renvoie (rate = coût en USD pour 1 000, en texte). */
export interface RawProviderService {
  service: number;
  name: string;
  type: string;
  rate: string;
  min: number | string;
  max: number | string;
  dripfeed: boolean;
  refill: boolean;
  cancel: boolean;
  category: string;
}

let cache: RawProviderService[] | null = null;

/** ~150 vrais services (instantané brut du fournisseur), lus une fois. Copie fraîche à chaque appel. */
export function loadProviderFixture(): RawProviderService[] {
  cache ??= JSON.parse(
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'provider-services.json'), 'utf8'),
  ) as RawProviderService[];
  return structuredClone(cache);
}

export function fixtureService(id: number): RawProviderService {
  const found = loadProviderFixture().find((s) => s.service === id);
  if (!found) throw new Error(`Service ${id} absent de tests/fixtures/provider-services.json`);
  return found;
}
