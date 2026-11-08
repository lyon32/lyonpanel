import { beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }));

import { setCurrencyCookie } from '@/lib/actions/currency';
import { CURRENCY_COOKIE, CURRENCY_COOKIE_OPTIONS } from '@/lib/currency';

describe('cookie de devise', () => {
  beforeEach(() => set.mockClear());

  it('porte le nom imposé par LLD §5', () => {
    expect(CURRENCY_COOKIE).toBe('lp_currency');
  });

  it('est valable sur tout le site (donc dans les deux langues), 1 an', () => {
    expect(CURRENCY_COOKIE_OPTIONS.path).toBe('/');
    expect(CURRENCY_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 365);
  });

  it('écrit la devise choisie dans lp_currency', async () => {
    await setCurrencyCookie('USD');
    expect(set).toHaveBeenCalledWith('lp_currency', 'USD', CURRENCY_COOKIE_OPTIONS);
  });
});
