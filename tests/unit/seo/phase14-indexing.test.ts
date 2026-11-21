import { globSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';
import { PRIVATE_ROBOTS, isSiteIndexable, publicRobots } from '@/lib/seo/indexing';

afterEach(() => vi.unstubAllEnvs());

describe('isSiteIndexable', () => {
  it('est faux sans variable', () => expect(isSiteIndexable({})).toBe(false));
  it.each(['TRUE', 'True', '1', 'yes', ' true', ''])('est faux pour « %s »', (v) =>
    expect(isSiteIndexable({ SITE_INDEXABLE: v })).toBe(false),
  );
  it('est vrai seulement pour "true" exact', () =>
    expect(isSiteIndexable({ SITE_INDEXABLE: 'true' })).toBe(true));
});

describe('publicRobots', () => {
  it('noindex, nofollow tant que non indexable', () => {
    expect(publicRobots({})).toMatchObject({ index: false, follow: false });
  });
  it('index, follow quand indexable', () => {
    expect(publicRobots({ SITE_INDEXABLE: 'true' })).toMatchObject({ index: true, follow: true });
  });
  it('PRIVATE_ROBOTS est toujours noindex, nofollow', () => {
    expect(PRIVATE_ROBOTS).toEqual({ index: false, follow: false });
  });
});

describe('robots.txt', () => {
  it('Disallow: / sans sitemap tant que non indexable', () => {
    vi.stubEnv('SITE_INDEXABLE', '');
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toBe('/');
    expect(r.sitemap).toBeUndefined();
  });
  it('autorise le public et publie le sitemap quand indexable', () => {
    vi.stubEnv('SITE_INDEXABLE', 'true');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).not.toBe('/');
    expect(rule?.disallow).toContain('/api/');
    expect(r.sitemap).toBe('https://lyonpanel.com/sitemap.xml');
  });
});

describe('pages privées', () => {
  const files = [
    ...globSync('src/app/[[]locale]/(app)/**/page.tsx'),
    ...globSync('src/app/[[]locale]/prototypes/**/page.tsx'),
    ...globSync('src/app/gestion/**/layout.tsx'),
  ];
  it('trouve les fichiers privés', () => expect(files.length).toBeGreaterThan(10));
  it.each(files)('%s utilise PRIVATE_ROBOTS (noindex permanent)', (f) => {
    expect(readFileSync(f, 'utf8')).toContain('PRIVATE_ROBOTS');
  });
});
