import { expect, test, type Page } from '@playwright/test';

/*
 * Balises SEO lues dans le vrai HTML (serveur local). Le serveur de dev tourne sans
 * SITE_INDEXABLE : le site est donc non indexable (noindex partout). Ce test vérifie la
 * structure des balises, pas le mode « indexable » (couvert en Vitest).
 */

const SITE = 'https://lyonpanel.com';

interface Tags {
  title: string;
  description: string;
  canonical: string | null;
  alternates: Record<string, string>;
  robots: string;
  ogImage: string | null;
  ogImageWidth: string | null;
  ogImageHeight: string | null;
  twitterCard: string | null;
  jsonLd: string[];
}

async function readTags(page: Page): Promise<Tags> {
  return page.evaluate(() => {
    const meta = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? null;
    const alternates: Record<string, string> = {};
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => {
      alternates[l.getAttribute('hreflang') ?? ''] = l.getAttribute('href') ?? '';
    });
    return {
      title: document.title,
      description: meta('meta[name="description"]') ?? '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      alternates,
      robots: meta('meta[name="robots"]') ?? '',
      ogImage: meta('meta[property="og:image"]'),
      ogImageWidth: meta('meta[property="og:image:width"]'),
      ogImageHeight: meta('meta[property="og:image:height"]'),
      twitterCard: meta('meta[name="twitter:card"]'),
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (s) => s.textContent ?? '',
      ),
    };
  });
}

const PUBLIC = [
  { name: 'accueil', path: '' },
  { name: 'services', path: '/services' },
  { name: 'faq', path: '/faq' },
  { name: 'contact', path: '/contact' },
] as const;

for (const lang of ['fr', 'en'] as const) {
  test.describe(`SEO ${lang}`, () => {
    for (const p of PUBLIC) {
      test(`${p.name} : titre, description, canonical, hreflang, OG, Twitter`, async ({ page }) => {
        await page.goto(`/${lang}${p.path}`);
        const t = await readTags(page);
        expect(t.title.length).toBeGreaterThan(0);
        expect(t.title.length).toBeLessThanOrEqual(60);
        expect(t.description.length).toBeGreaterThanOrEqual(70);
        expect(t.description.length).toBeLessThanOrEqual(160);
        expect(t.canonical).toBe(`${SITE}/${lang}${p.path}`);
        expect(t.alternates).toEqual({
          fr: `${SITE}/fr${p.path}`,
          en: `${SITE}/en${p.path}`,
          'x-default': `${SITE}/fr${p.path}`,
        });
        expect(t.ogImage).toMatch(/^https:\/\//);
        expect(t.ogImageWidth).toBe('1200');
        expect(t.ogImageHeight).toBe('630');
        expect(t.twitterCard).toBe('summary_large_image');
        // Site non indexable par défaut : jamais d'index.
        expect(t.robots).toContain('noindex');
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
      });
    }

    for (const p of PUBLIC) {
      test(`${p.name} : JSON-LD valide, sans « < » brut`, async ({ page }) => {
        await page.goto(`/${lang}${p.path}`);
        const { jsonLd } = await readTags(page);
        expect(jsonLd.length).toBeGreaterThan(0);
        for (const raw of jsonLd) {
          expect(raw).not.toContain('<');
          expect(JSON.parse(raw)['@context']).toBe('https://schema.org');
        }
      });
    }

    test('page réseau (tiktok) : balises et JSON-LD (saute si catalogue indisponible)', async ({
      page,
    }) => {
      const res = await page.goto(`/${lang}/services/tiktok`);
      const down = !res || res.status() >= 500;
      if (process.env.CI) {
        expect(down, 'La page réseau ne doit pas renvoyer 5xx en CI').toBe(false);
      } else {
        test.skip(down, 'Catalogue indisponible sans base : page réseau non testée');
      }
      const t = await readTags(page);
      expect(t.title.length).toBeLessThanOrEqual(60);
      expect(t.canonical).toBe(`${SITE}/${lang}/services/tiktok`);
      expect(Object.keys(t.alternates).sort()).toEqual(['en', 'fr', 'x-default']);
      expect(t.robots).toContain('noindex');
      for (const raw of t.jsonLd) {
        expect(raw).not.toContain('<');
        JSON.parse(raw);
      }
    });

    test('connexion : noindex, nofollow', async ({ page }) => {
      await page.goto(lang === 'fr' ? '/fr/connexion' : '/en/login');
      const t = await readTags(page);
      expect(t.robots).toContain('noindex');
      expect(t.robots).toContain('nofollow');
    });

    test('page privée sans session : redirigée vers la connexion en noindex, nofollow', async ({
      page,
    }) => {
      await page.goto(lang === 'fr' ? '/fr/tableau-de-bord' : '/en/dashboard');
      await expect(page).toHaveURL(/connexion|login/);
      const t = await readTags(page);
      expect(t.robots).toContain('noindex');
      expect(t.robots).toContain('nofollow');
    });
  });
}

test('robots.txt interdit tout par défaut et sitemap vide', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow:\s*\/\s*$/m);
  expect(robots).not.toMatch(/Sitemap:/i);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('<loc>');
});

test('/admin renvoie 404', async ({ request }) => {
  expect((await request.get('/admin')).status()).toBe(404);
});
