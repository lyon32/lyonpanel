import { expect, test } from '@playwright/test';

const LOCALES = [
  { code: 'fr', bottom: 'Menu du bas', app: 'Espace client', lang: 'Langue', other: 'English' },
  { code: 'en', bottom: 'Bottom menu', app: 'Customer area', lang: 'Language', other: 'Français' },
] as const;

for (const loc of LOCALES) {
  const url = `/${loc.code}/demo`;

  test.describe(`page de démonstration (${loc.code})`, () => {
    test('répond 200, bonne langue, noindex et un titre h1', async ({ page }) => {
      const response = await page.goto(url);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', loc.code);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots).toContain('noindex');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });

    test('montre tous les blocs de composants', async ({ page }) => {
      await page.goto(url);
      for (const id of [
        'demo-buttons',
        'demo-fields',
        'demo-cards',
        'demo-badges',
        'demo-table',
        'demo-dialog',
        'demo-states',
        'demo-layout-preview',
      ]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      await expect(page.getByTestId('demo-buttons').getByRole('button').first()).toBeVisible();
      // champ avec libellé associé
      await expect(page.getByTestId('demo-fields').getByLabel(/./).first()).toBeVisible();
      // les 4 statuts de commande
      await expect(page.getByTestId('demo-badges').getByTestId('demo-badge')).toHaveCount(4);
      await expect(page.getByTestId('demo-table').getByRole('table')).toBeVisible();
      // états vide / chargement / erreur
      const states = page.getByTestId('demo-states');
      await expect(states.getByTestId('demo-state-empty')).toBeVisible();
      await expect(states.getByRole('status')).toBeVisible();
      await expect(states.getByRole('alert')).toBeVisible();
    });

    test('ouvre un dialogue et le ferme avec Échap', async ({ page }) => {
      await page.goto(url);
      await page.getByTestId('demo-dialog').getByRole('button').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('360 px : aucun défilement horizontal et menu du bas visible', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(url);
      const ok = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(ok).toBe(true);
      const preview = page.getByTestId('demo-layout-preview');
      await expect(preview.getByRole('navigation', { name: loc.bottom })).toBeVisible();
    });

    test('1280 px : barre latérale visible, menu du bas masqué', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url);
      const preview = page.getByTestId('demo-layout-preview');
      await expect(preview.getByRole('navigation', { name: loc.app })).toBeVisible();
      await expect(preview.getByRole('navigation', { name: loc.bottom })).toBeHidden();
    });
  });
}

test('le sélecteur de langue de /fr/demo mène à /en/demo', async ({ page }) => {
  await page.goto('/fr/demo');
  await page
    .getByRole('group', { name: 'Langue' })
    .first()
    .getByRole('button', { name: 'English' })
    .click();
  await expect(page).toHaveURL(/\/en\/demo$/);
});

test('changer la devise met à jour le cookie NEXT_CURRENCY', async ({ page, context }) => {
  await page.goto('/fr/demo');
  await page.getByRole('combobox', { name: 'Devise' }).first().selectOption('USD');
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === 'NEXT_CURRENCY')?.value)
    .toBe('USD');
});
