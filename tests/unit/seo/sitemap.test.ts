import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const list = vi.fn();
vi.mock('@/server/catalog/public-catalog', () => ({ listPublicServices: () => list() }));

import sitemap from '@/app/sitemap';

const row = {
  id: 1,
  platform: 'tiktok',
  category: 'followers',
  name_fr: 'x',
  price_xaf_1000: 1000,
  min_qty: 10,
  max_qty: 100,
  refill: false,
  cancel: false,
  dripfeed: false,
  sort_order: 1,
};

describe('sitemap', () => {
  beforeEach(() => {
    list.mockReset();
  });

  it('pages fixes seules si la base est injoignable', async () => {
    list.mockImplementation(async () => {
      throw new Error('down');
    });
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual([
      'https://lyonpanel.com/fr',
      'https://lyonpanel.com/en',
      'https://lyonpanel.com/fr/services',
      'https://lyonpanel.com/en/services',
    ]);
  });

  it('ajoute réseaux et listes FR/EN avec hreflang, sans fiches ni admin', async () => {
    list.mockResolvedValue([row]);
    const s = await sitemap();
    const urls = s.map((e) => e.url);
    expect(urls).toContain('https://lyonpanel.com/en/services/tiktok');
    expect(urls).toContain('https://lyonpanel.com/fr/services/tiktok/followers');
    expect(urls.some((u) => /\/services\/\w+\/\w+\/\d+/.test(u) || /admin|demo/.test(u))).toBe(
      false,
    );
    const e = s.find((x) => x.url.endsWith('/en/services/tiktok'));
    expect(e?.alternates?.languages).toMatchObject({
      fr: 'https://lyonpanel.com/fr/services/tiktok',
      en: 'https://lyonpanel.com/en/services/tiktok',
      'x-default': 'https://lyonpanel.com/fr/services/tiktok',
    });
    expect(s.length).toBeLessThanOrEqual(50_000);
  });
});
