import { expect, test, type Page } from '@playwright/test';

/*
 * Parcours du catalogue public (phase 4) : réseaux -> types -> services -> fiche.
 * Écrit AVANT les pages : il ne passera qu'une fois les écrans de la tâche 4.6 en place.
 *
 * Adresses proposées (à valider par le chef de projet, non imposées) :
 *   /{locale}/services                          les réseaux
 *   /{locale}/services/{réseau}                 les types du réseau
 *   /{locale}/services/{réseau}/{type}          la liste des services
 *   /{locale}/services/{réseau}/{type}/{id}     la fiche d'un service
 *   (réseau et type = identifiants de code, identiques en FR et EN : tiktok, followers…)
 * Sélecteurs stables demandés :
 *   [data-testid="network-card"]   un réseau        (lien)
 *   [data-testid="type-card"]      un type          (lien)
 *   [data-testid="service-row"]    un service       (contient un lien vers la fiche)
 *   [data-testid="service-price"]  prix pour 1 000  (dans la devise choisie)
 *   [data-testid="service-min-order"]  « commande minimum »
 *   liste déroulante « Devise » / « Currency » (role combobox), déjà présente dans l'en-tête.
 * Prérequis : base locale avec le catalogue de démonstration (seed) : tiktok / followers au moins.
 */

const FORBIDDEN = /peakerr|justanotherpanel|\bjap\b|provider_name|cost_usd|costusd1000/i;

async function noHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

for (const locale of ['fr', 'en'] as const) {
  const L =
    locale === 'fr'
      ? { followers: 'Abonnés', minOrder: /commande minimum/i, price: /1\s?000/ }
      : { followers: 'Followers', minOrder: /minimum order/i };

  test.describe(`catalogue en ${locale}`, () => {
    test('page des réseaux -> un réseau -> ses types -> la liste des services', async ({
      page,
    }) => {
      await page.goto(`/${locale}/services`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const networks = page.locator('[data-testid="network-card"]');
      expect(await networks.count()).toBeGreaterThan(0);

      await page.locator('[data-testid="network-card"]', { hasText: 'TikTok' }).first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/services/tiktok$`));

      await page.locator('[data-testid="type-card"]', { hasText: L.followers }).first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/services/tiktok/followers$`));

      const rows = page.locator('[data-testid="service-row"]');
      expect(await rows.count()).toBeGreaterThan(0);
      await expect(rows.first().locator('[data-testid="service-price"]')).toContainText(/XAF/);
      await expect(rows.first().locator('[data-testid="service-min-order"]')).toContainText(
        L.minOrder,
      );
    });

    test('la fiche d un service montre le numéro, le prix, la commande minimum et les quantités', async ({
      page,
    }) => {
      await page.goto(`/${locale}/services/tiktok/followers`);
      await page.locator('[data-testid="service-row"] a').first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/services/tiktok/followers/\\d+$`));
      await expect(page.getByRole('heading', { level: 1 })).toContainText('#');
      await expect(page.locator('[data-testid="service-price"]').first()).toContainText(/XAF/);
      await expect(page.locator('[data-testid="service-min-order"]').first()).toContainText(
        L.minOrder,
      );
    });

    test('aucune mention du fournisseur dans le HTML rendu', async ({ page }) => {
      for (const path of [
        `/${locale}/services`,
        `/${locale}/services/tiktok`,
        `/${locale}/services/tiktok/followers`,
      ]) {
        const res = await page.request.get(path);
        expect(res.status(), path).toBe(200);
        expect(await res.text(), path).not.toMatch(FORBIDDEN);
        await page.goto(path);
        expect(await page.content(), path).not.toMatch(FORBIDDEN);
        expect(await page.title(), path).not.toMatch(FORBIDDEN);
      }
    });

    test('mobile 360 px : aucun défilement horizontal sur les 3 niveaux', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      for (const path of [
        `/${locale}/services`,
        `/${locale}/services/tiktok`,
        `/${locale}/services/tiktok/followers`,
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await noHorizontalScroll(page);
      }
    });

    test('une adresse inconnue donne une 404', async ({ page }) => {
      for (const path of [
        `/${locale}/services/reseau-inconnu`,
        `/${locale}/services/tiktok/type-inconnu`,
        `/${locale}/services/tiktok/followers/999999999`,
      ]) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(404);
      }
    });
  });
}

test('la devise XAF / XOF / USD change l affichage des prix, sans changer le prix réel', async ({
  page,
}) => {
  await page.goto('/fr/services/tiktok/followers');
  const price = page.locator('[data-testid="service-price"]').first();
  const devise = page.getByRole('combobox', { name: 'Devise' }).first();

  await expect(price).toContainText('XAF');
  const xaf = (await price.innerText()).replace(/\D/g, '');

  await devise.selectOption('XOF');
  await expect(price).toContainText('XOF');
  expect((await price.innerText()).replace(/\D/g, '')).toBe(xaf); // parité XAF = XOF

  await devise.selectOption('USD');
  await expect(price).toContainText(/\$|USD/);
  expect((await price.innerText()).replace(/\D/g, '')).not.toBe(xaf);

  await devise.selectOption('XAF');
  await expect(price).toContainText('XAF');
});

test('la devise choisie reste sur la fiche d un service', async ({ page }) => {
  await page.goto('/fr/services/tiktok/followers');
  await page.getByRole('combobox', { name: 'Devise' }).first().selectOption('USD');
  await page.locator('[data-testid="service-row"] a').first().click();
  await expect(page.locator('[data-testid="service-price"]').first()).toContainText(/\$|USD/);
});

test('l API publique du catalogue ne laisse rien passer du fournisseur', async ({ page }) => {
  const res = await page.request.get('/api/v1/services?currency=USD&locale=en');
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).not.toMatch(FORBIDDEN);
  expect(text).not.toMatch(/margin|multiplier|cost/i);
  const body = JSON.parse(text);
  expect(body.currency).toBe('USD');
  expect(Array.isArray(body.networks)).toBe(true);
});
