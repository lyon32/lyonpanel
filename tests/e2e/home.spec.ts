import { expect, test } from '@playwright/test';

test("affiche le héros sur la page d'accueil", async ({ page }) => {
  // Mobile 360 x 740 : aucun défilement horizontal
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/fr');

  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('Fais grandir ta présence sur les réseaux sociaux');
  await expect(page.getByRole('link', { name: 'Créer un compte' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comment ça marche' }).first()).toBeVisible();

  const noHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalScroll).toBe(true);
});

test('héros EN : titre et boutons, sans prix, devise, pays ni Mobile Money', async ({ page }) => {
  await page.goto('/en');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('Grow your presence on social media');
  await expect(page.getByRole('link', { name: 'Create an account' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'How it works' }).first()).toBeVisible();

  const heroText = await h1.evaluate((el) => (el.closest('section') ?? el).textContent ?? '');
  expect(heroText).not.toMatch(
    /Mobile Money|XAF|FCFA|\d+\s?(€|\$)|Cameroun|Cameroon|Sénégal|Senegal/i,
  );
});

const noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;

const LANGS = [
  {
    code: 'fr',
    steps: ['Recharge ton solde', 'Choisis un service', 'Suis ta commande'],
    note: /Les moyens disponibles varient/,
    first: 'Comment je recharge mon solde ?',
    second: 'À partir de quel montant puis-je commander ?',
  },
  {
    code: 'en',
    steps: ['Top up your balance', 'Pick a service', 'Follow your order'],
    note: /Available methods vary/,
    first: 'How do I top up my balance?',
    second: 'What is the minimum order?',
  },
] as const;

for (const l of LANGS) {
  test.describe(`accueil ${l.code}`, () => {
    test('section étapes (#how) : trois étapes, sans section épinglée', async ({ page }) => {
      await page.goto(`/${l.code}`);
      const how = page.locator('#how');
      await expect(how).toBeAttached();
      for (const name of l.steps) {
        await expect(how.getByRole('heading', { name, level: 3 })).toBeAttached();
      }
      await expect(page.locator('[data-pinned]')).toHaveCount(0);
    });

    test('tuiles de services : chaque tuile mène à /services/<réseau>', async ({ page }) => {
      await page.goto(`/${l.code}`);
      for (const id of ['instagram', 'tiktok', 'youtube', 'facebook', 'telegram', 'x']) {
        await expect(page.locator(`[data-slot="tuile-${id}"] a`)).toHaveAttribute(
          'href',
          `/${l.code}/services/${id}`,
        );
      }
      await expect(page.locator('[data-slot="tuile-plus"] a')).toHaveAttribute(
        'href',
        `/${l.code}/services`,
      );
    });

    test('section paiements : 7 logos et mention de variation des moyens', async ({ page }) => {
      await page.goto(`/${l.code}`);
      const pay = page.locator('#paiements');
      await expect(pay.locator('[data-pay]')).toHaveCount(7);
      await expect(pay).toContainText(l.note);
    });

    test('FAQ : ouverture et fermeture au clavier', async ({ page }) => {
      await page.goto(`/${l.code}`);
      const first = page.getByRole('button', { name: l.first });
      const second = page.getByRole('button', { name: l.second });
      await second.scrollIntoViewIfNeeded();
      await expect(second).toHaveAttribute('aria-expanded', 'false');
      await second.focus();
      await page.keyboard.press('Enter');
      await expect(second).toHaveAttribute('aria-expanded', 'true');
      await expect(first).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Space');
      await expect(second).toHaveAttribute('aria-expanded', 'false');
    });

    test('pas de débordement horizontal à 360 px', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(`/${l.code}`);
      expect(await page.evaluate(noOverflow)).toBe(true);
    });
  });
}
