import { afterAll, describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';

// Règle de la phase 14 : noindex par défaut ; ici on teste le site indexable.
vi.stubEnv('SITE_INDEXABLE', 'true');
vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
afterAll(() => vi.unstubAllEnvs());

describe('robots', () => {
  const r = robots();
  const text = JSON.stringify(r);

  it('interdit /api/ et les pages client FR/EN', () => {
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const d = (rule?.disallow ?? []) as string[];
    expect(d).toContain('/api/');
    expect(d).toContain('/fr/tableau-de-bord');
    expect(d).toContain('/en/dashboard');
    expect(d).toContain('/fr/commander');
  });

  it("indique le sitemap et ne cite ni l'admin ni /demo", () => {
    expect(r.sitemap).toBe('https://lyonpanel.com/sitemap.xml');
    expect(text).not.toMatch(/admin|demo/i);
  });
});
