import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { CURRENCY_COOKIE, parseCurrency, type Currency } from '@/lib/currency';
import type { CatalogLocale } from '@/server/catalog/labels';
import {
  buildPublicCatalog,
  toPublicService,
  type PublicCatalog,
  type PublicService,
} from '@/server/catalog/present-catalog';
import {
  getPublicService,
  getUsdXafRate,
  listPublicServices,
} from '@/server/catalog/public-catalog';

// Une seule lecture de la vue par requête, même si plusieurs composants la demandent.
const rowsOfRequest = cache(listPublicServices);

/** Devise du cookie et taux d'affichage (1 hors USD). Les prix restent calculés par le serveur. */
async function readDisplay(): Promise<{ currency: Currency; usdXafRate: number }> {
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  return { currency, usdXafRate: currency === 'USD' ? await getUsdXafRate() : 1 };
}

export interface CatalogView {
  currency: Currency;
  usdXafRate: number;
  catalog: PublicCatalog;
}

export async function loadCatalogView(locale: CatalogLocale): Promise<CatalogView> {
  const display = await readDisplay();
  const rows = await rowsOfRequest();
  return { ...display, catalog: buildPublicCatalog(rows, { ...display, locale }) };
}

export interface ServiceView {
  currency: Currency;
  usdXafRate: number;
  service: PublicService;
}

export async function loadServiceView(
  id: number,
  locale: CatalogLocale,
): Promise<ServiceView | null> {
  const row = await getPublicService(id);
  if (!row) return null;
  const display = await readDisplay();
  return { ...display, service: toPublicService(row, { ...display, locale }) };
}
