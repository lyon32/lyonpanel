import { expect, test, type Page } from '@playwright/test';

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

test('changer la devise met à jour le cookie lp_currency', async ({ page, context }) => {
  await page.goto('/fr/demo');
  // Avant que la page soit active, le choix est perdu : on réessaie jusqu'à ce qu'il prenne.
  await expect(async () => {
    await page.getByRole('combobox', { name: 'Devise' }).first().selectOption('USD');
    const cookie = (await context.cookies()).find((c) => c.name === 'lp_currency');
    expect(cookie?.value).toBe('USD');
  }).toPass({ timeout: 20_000 });
});

// Les blocs lourds ne se montent qu'à l'approche de l'écran : on descend la page pour les faire apparaître.
async function scrollThrough(page: Page) {
  for (let y = 0; y < 9000; y += 600) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
}

test('focus clavier : chaque onglet « Nouvelle commande » montre un anneau visible', async ({
  page,
}) => {
  await page.goto('/fr/demo');
  await scrollThrough(page);
  const first = page.getByRole('tab', { name: 'Nouvelle commande' });
  await first.scrollIntoViewIfNeeded();
  await first.focus();
  const count = await page.getByRole('tab').count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) {
    const focused = page.locator('[role="tab"]:focus');
    await expect(focused).toHaveCount(1);
    // On attend la fin de la transition du focus (le serveur de CI est lent).
    await expect
      .poll(
        () =>
          focused.evaluate((el) => {
            const cs = getComputedStyle(el);
            return cs.boxShadow !== 'none' && cs.borderTopColor !== 'rgba(0, 0, 0, 0)';
          }),
        { timeout: 5000 },
      )
      .toBe(true);
    await page.keyboard.press('ArrowRight');
  }
});

test('cibles tactiles >= 44 px sur téléphone : logo, onglets, bouton principal', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/fr/demo');
  await scrollThrough(page);
  const logo = page.getByRole('link', { name: 'LyonPanel' }).first();
  const create = page.getByRole('button', { name: /Créer un compte/ }).first();
  const tab = page.getByRole('tab').first();
  await tab.scrollIntoViewIfNeeded();
  for (const el of [logo, create, tab]) {
    const box = await el.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  }
  await context.close();
});

test('la pile d’écrans ouvre le détail au clic et au clavier, Échap le ferme', async ({ page }) => {
  await page.goto('/fr/demo');
  await scrollThrough(page);
  const card = page.getByRole('button', { name: /Voir le détail/ }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('mouvement réduit : aucune animation continue ne reste active', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/fr/demo');
  for (let y = 0; y < 8000; y += 700) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(150);
  }
  const running = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === 'running').length,
  );
  expect(running).toBe(0);
  await context.close();
});
