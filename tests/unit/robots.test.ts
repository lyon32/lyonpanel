import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

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
