'use server';

import { cookies } from 'next/headers';
import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_OPTIONS,
  parseCurrency,
  type Currency,
} from '@/lib/currency';

// Valeur inconnue -> XAF ; le cookie ne sert qu'à l'affichage.
export async function setCurrencyCookie(value: Currency): Promise<void> {
  const store = await cookies();
  store.set(CURRENCY_COOKIE, parseCurrency(value), CURRENCY_COOKIE_OPTIONS);
}
