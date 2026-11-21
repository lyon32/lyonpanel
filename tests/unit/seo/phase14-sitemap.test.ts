import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const list = vi.fn();
vi.mock('@/server/catalog/public-catalog', () => ({ listPublicServices: () => list() }));

import sitemap from '@/app/sitemap';

const mk = (platform: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: platform.length * 1000 + i,
    platform,
    category: 'followers',
    name_fr: 'x',
    price_xaf_1000: 1000,
    min_qty: 10,
    max_qty: 100,
    refill: false,
    cancel: false,
    dripfeed: false,
    sort_order: i,
  }));

const HOST = 'https://staging.example.com';

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue([...mk('tiktok', 12), ...mk('whatsapp', 3)]);
});
afterEach(() => vi.unstubAllEnvs());

describe('sitemap (phase 14)', () => {
  it('vide tant que le site est non indexable', async () => {
    vi.stubEnv('SITE_INDEXABLE', '');
    expect(await sitemap()).toEqual([]);
  });

  describe('indexable', () => {
    beforeEach(() => {
      vi.stubEnv('SITE_INDEXABLE', 'true');
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', HOST);
    });

    it('contient accueil, services, faq, contact en fr et en', async () => {
      const urls = (await sitemap()).map((e) => e.url);
      for (const p of ['', '/services', '/faq', '/contact']) {
        expect(urls).toContain(`${HOST}/fr${p}`);
        expect(urls).toContain(`${HOST}/en${p}`);
      }
    });
    it('contient le réseau riche, pas le réseau mince', async () => {
      const urls = (await sitemap()).map((e) => e.url);
      expect(urls).toContain(`${HOST}/fr/services/tiktok`);
      expect(urls.some((u) => u.includes('/services/whatsapp'))).toBe(false);
    });
    it('exclut fiches, prototypes, demo, auth, client, admin', async () => {
      const urls = (await sitemap()).map((e) => e.url);
      const bad =
        /\/services\/\w+\/\w+\/\d+|prototypes|demo|login|register|password|dashboard|tableau-de-bord|account|admin|gestion/;
      expect(urls.filter((u) => bad.test(u))).toEqual([]);
    });
    it('chaque entrée a hreflang fr/en/x-default sur le bon SITE_URL', async () => {
      const s = await sitemap();
      expect(s.length).toBeGreaterThan(0);
      for (const e of s) {
        const l = e.alternates?.languages as Record<string, string>;
        expect(Object.keys(l).sort()).toEqual(['en', 'fr', 'x-default']);
        expect(Object.values(l).every((u) => u.startsWith(`${HOST}/`))).toBe(true);
        expect(l['x-default']).toBe(l.fr);
        expect(e.url.startsWith(`${HOST}/`)).toBe(true);
      }
    });
  });
});
