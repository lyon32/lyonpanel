// Charge un fichier brut dans la base LOCALE (jamais une base distante).
// Usage : CATALOGUE_RAW=<fichier brut .json> + variables Supabase locales, puis npm run catalogue:import-local
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { syncServices } from '@/server/catalog/sync-services';
import { createSupabaseCatalogStore } from '@/server/catalog/supabase-catalog-store';
import { createMockProvider } from '@/server/providers/mock-provider';

test('importe le catalogue en local', async () => {
  const raw = process.env.CATALOGUE_RAW;
  if (!raw) throw new Error('Variable CATALOGUE_RAW manquante.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // Garde-fou : on n'écrit jamais dans une base qui n'est pas sur cette machine.
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
    throw new Error("Refus : l'URL Supabase n'est pas locale.");
  }
  const provider = createMockProvider({ services: JSON.parse(readFileSync(raw, 'utf8')) });
  const result = await syncServices({ provider, store: createSupabaseCatalogStore() });
  process.stdout.write(`\nRÉSULTAT IMPORT ${JSON.stringify(result)}\n`);
});
