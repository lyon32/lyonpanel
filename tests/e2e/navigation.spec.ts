import { expect, test } from '@playwright/test';

const locales = ['fr', 'en'] as const;

// Toutes les adresses internes des menus (en-tête, pied de page, barre latérale, barre du bas) répondent 200.
for (const locale of locales) {
  test(`les liens de navigation de /${locale}/demo et /${locale} aboutissent à un 200`, async ({
    page,
  }) => {
    const hrefs = new Set<string>();
    for (const path of [`/${locale}`, `/${locale}/demo`]) {
      await page.goto(path);
      const found = await page
        .locator('a[href^="/"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
      found.forEach((h) => hrefs.add(h.split('#')[0] ?? ''));
    }
    expect(hrefs.size).toBeGreaterThan(8);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href}`).toBe(200);
    }
  });
}

test('les 14 adresses traduites + services et blog répondent 200 en FR et EN', async ({ page }) => {
  const fr = [
    'commander',
    'commandes',
    'recharger',
    'tableau-de-bord',
    'transactions',
    'favoris',
    'support',
    'parrainage',
    'compte',
    'connexion',
    'inscription',
    'mot-de-passe-oublie',
    'confidentialite',
    'conditions',
    'services',
    'blog',
  ];
  const en = [
    'order',
    'orders',
    'add-funds',
    'dashboard',
    'transactions',
    'favorites',
    'support',
    'referral',
    'account',
    'login',
    'register',
    'forgot-password',
    'privacy',
    'terms',
    'services',
    'blog',
  ];
  for (const p of fr) expect((await page.request.get(`/fr/${p}`)).status(), p).toBe(200);
  for (const p of en) expect((await page.request.get(`/en/${p}`)).status(), p).toBe(200);
});

test('une page privée est noindex', async ({ page }) => {
  await page.goto('/fr/connexion');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('une adresse inconnue affiche le 404 du site, avec la bonne langue', async ({ page }) => {
  for (const [path, lang, title] of [
    ['/fr/page-inexistante', 'fr', /introuvable/i],
    ['/en/nope', 'en', /not found/i],
    ['/zz/abc', null, null],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    if (lang && title) {
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
  }
});

test('la devise reste choisie en passant de /fr à /en', async ({ page }) => {
  await page.goto('/fr/demo');
  await page.getByRole('combobox', { name: 'Devise' }).first().selectOption('USD');
  await expect(page.getByRole('combobox', { name: 'Devise' }).first()).toHaveValue('USD');
  await page.goto('/en/demo');
  await expect(page.getByRole('combobox', { name: 'Currency' }).first()).toHaveValue('USD');
});
