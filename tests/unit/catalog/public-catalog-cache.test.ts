import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const calls: { keys: string[]; opts: { revalidate: number; tags: string[] } }[] = [];
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, keys: string[], opts: { revalidate: number; tags: string[] }) => {
    calls.push({ keys, opts });
    return fn;
  },
}));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/server/db/supabase-server', () => ({ createStatelessClient: vi.fn() }));

describe('cache du catalogue public', () => {
  beforeEach(() => vi.resetModules());

  it('garde la liste et le taux 300 s avec la balise « catalog »', async () => {
    await import('@/server/catalog/public-catalog');
    expect(calls).toHaveLength(2);
    for (const c of calls) expect(c.opts).toEqual({ revalidate: 300, tags: ['catalog'] });
  });

  it('ne dépend pas du cookie : le fichier ne lit ni cookies() ni headers()', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/server/catalog/public-catalog.ts', 'utf8');
    expect(src).not.toMatch(/next\/headers|cookies\(|headers\(/);
  });
});
