import 'server-only';
import { createMockProvider } from './mock-provider';
import { createProviderClient } from './provider-client';
import type { ProviderApi } from './types';
import { loadServerEnv } from '@/server/env';

let mock: ProviderApi | null = null;

/** Faux fournisseur par défaut ; le vrai client seulement avec PROVIDER_MODE=live (production). */
export function getProvider(): ProviderApi {
  const env = loadServerEnv();
  if (env.PROVIDER_MODE === 'mock') return (mock ??= createMockProvider());
  const { PROVIDER_API_URL: apiUrl, PROVIDER_API_KEY: apiKey } = env;
  if (!apiUrl || !apiKey) {
    throw new Error('PROVIDER_API_URL et PROVIDER_API_KEY sont obligatoires en mode live');
  }
  return createProviderClient({ apiUrl, apiKey });
}
