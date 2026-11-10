import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/catalog/public-catalog', () => ({ listPublicServices: async () => [] }));
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { authMetadata } from '@/lib/seo/auth-metadata';

describe('métadonnées des pages de compte', () => {
  it('noindex/nofollow, canonical et hreflang localisés', () => {
    const m = authMetadata('login', 'en');
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.alternates?.canonical).toBe('https://lyonpanel.com/en/login');
    expect(m.alternates?.languages).toMatchObject({
      fr: 'https://lyonpanel.com/fr/connexion',
      'x-default': 'https://lyonpanel.com/fr/connexion',
    });
    const r = authMetadata('reset-password', 'fr');
    expect(r.alternates?.canonical).toBe('https://lyonpanel.com/fr/nouveau-mot-de-passe');
  });

  it('description non vide et le sitemap ne contient aucune page de compte', () => {
    for (const p of ['login', 'register', 'forgot-password', 'reset-password'] as const) {
      expect(authMetadata(p, 'fr').description).toBeTruthy();
    }
    expect(JSON.stringify(sitemap())).not.toMatch(
      /connexion|inscription|login|register|password|mot-de-passe/,
    );
  });
});
