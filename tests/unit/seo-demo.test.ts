import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  it('ne contient aucune adresse de la page /demo', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.filter((u) => /\/demo(\/|$|\?)/.test(u))).toEqual([]);
  });
});
