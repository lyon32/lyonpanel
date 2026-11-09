import { expect, test, type Page } from '@playwright/test';

/*
 * Zone privée : en-tête de l'application sans coupure sur téléphone, et pas de page privée
 * gardée par le navigateur après déconnexion.
 * Prérequis : Supabase local + clés Turnstile de test (voir auth.spec.ts).
 */

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
const PATHS = {
  fr: { register: '/fr/inscription', dashboard: /\/fr\/tableau-de-bord/, login: /\/fr\/connexion/ },
  en: { register: '/en/register', dashboard: /\/en\/dashboard/, login: /\/en\/login/ },
} as const;

async function signUp(page: Page, locale: 'fr' | 'en') {
  const stamp = `${Date.now()}${locale === 'fr' ? 3 : 4}`;
  await page.goto(PATHS[locale].register);
  await page.locator('input[name="email"]').fill(`entete-${stamp}@lyonpanel.test`);
  await page.locator('input[name="phone"]').fill(`+2376${stamp.slice(-8)}`);
  await page.locator('input[name="password"]').fill(PASSWORD);
  const next = page.locator('[data-testid="register-next"]');
  if (await next.isVisible()) await next.click();
  await page.locator('[data-field="country"]').click();
  await page.locator('[role="option"][data-value="CM"]').click();
  await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 15_000,
  });
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(PATHS[locale].dashboard, { timeout: 45_000 });
}

const SIZES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
] as const;

for (const size of SIZES) {
  for (const locale of ['fr', 'en'] as const) {
    test(`en-tête entièrement visible à ${size.width}×${size.height} (${locale})`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await signUp(page, locale);
      const items = page
        .locator('header')
        .last()
        .locator('a:visible, button:visible, select:visible, span:visible');
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < count; i += 1) {
        const box = await items.nth(i).boundingBox();
        expect(box, `élément ${i}`).not.toBeNull();
        if (!box) continue;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      }
      // Cibles tactiles : sélecteurs, devise et déconnexion font au moins 44 px.
      for (const target of ['button[lang]', 'select', '[data-testid="logout"]']) {
        const buttons = page.locator('header').last().locator(target);
        for (let i = 0; i < (await buttons.count()); i += 1) {
          const box = await buttons.nth(i).boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        }
      }
      if (size.width < 768) await expect(page.locator('header img').last()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(0);
    });
  }
}

test('après déconnexion, Retour ne montre aucun contenu privé', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await signUp(page, 'fr');
  // Les pages privées ne sont jamais gardées par le navigateur.
  const response = await page.request.get('/fr/tableau-de-bord');
  expect(response.headers()['cache-control']).toContain('no-store');

  await page.locator('[data-testid="logout"]').click();
  await expect(page).toHaveURL(PATHS.fr.login);
  await page.goBack();
  // Soit retour direct à la connexion, soit aucune trace du bouton de déconnexion.
  await page.waitForLoadState('load');
  await expect(page).toHaveURL(PATHS.fr.login, { timeout: 20_000 });
  await expect(page.locator('[data-testid="logout"]')).toHaveCount(0);
});
