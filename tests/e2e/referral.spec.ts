import { expect, test, type Page } from '@playwright/test';

/*
 * Page /parrainage (FR) et /referral (EN) : code, lien, compteurs, barre de palier.
 * Prérequis : ceux de auth.spec.ts (Supabase local, Turnstile de test).
 *
 * Éléments attendus (data-testid), à fournir par lp-coder / lp-designer :
 *   referral-code        : le code à 8 caractères (texte seul)
 *   referral-copy-code   : bouton « copier le code »
 *   referral-link        : le lien d'invitation (texte contenant ?ref=<code>)
 *   referral-copy-link   : bouton « copier le lien »
 *   referral-count       : nombre de filleuls
 *   referral-earned      : total gagné en XAF
 *   referral-explainer   : explication du 5 % avec l'exemple 10 000 XAF -> 500 XAF
 *   discount-progress    : barre de palier (role="progressbar", aria-valuenow = total rechargé,
 *                          aria-valuemax = 50000) ; absente une fois le palier atteint
 *   discount-remaining   : texte « encore X XAF pour la remise de 10 % »
 */
const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';

test.use({ viewport: { width: 360, height: 740 } });

let counter = 0;
async function signedUp(page: Page): Promise<void> {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  await page.goto('/fr/inscription');
  await page.locator('input[name="email"]').fill(`client-ref-${stamp}@lyonpanel.test`);
  await page.locator('input[name="phone"]').fill(`+2376${stamp.slice(-8)}`);
  await page.locator('input[name="password"]').fill(PASSWORD);
  const next = page.locator('[data-testid="register-next"]');
  if (await next.isVisible()) await next.click();
  await page.locator('[data-field="country"]').click();
  await page.locator('[role="option"][data-value="CM"]').click();
  await page.locator('[data-field="display_currency"]').click();
  await page.locator('[role="option"][data-value="XAF"]').click();
  await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 15_000,
  });
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fr\/tableau-de-bord/, { timeout: 45_000 });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('page parrainage', () => {
  test('FR : affiche code, lien, compteurs à 0, explication et barre de palier, sans défilement horizontal', async ({
    page,
  }) => {
    await signedUp(page);
    await page.goto('/fr/parrainage');

    const code = (await page.getByTestId('referral-code').innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    await expect(page.getByTestId('referral-link')).toContainText(`ref=${code}`);
    await expect(page.getByTestId('referral-copy-code')).toBeVisible();
    await expect(page.getByTestId('referral-copy-link')).toBeVisible();
    await expect(page.getByTestId('referral-count')).toHaveText(/^\s*0\s*$/);
    await expect(page.getByTestId('referral-earned')).toContainText('0');
    await expect(page.getByTestId('referral-explainer')).toContainText(/10\D?000/);
    await expect(page.getByTestId('referral-explainer')).toContainText('500');

    const bar = page.getByTestId('discount-progress');
    await expect(bar).toHaveAttribute('role', 'progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    await expect(bar).toHaveAttribute('aria-valuemax', '50000');
    await expect(page.getByTestId('discount-remaining')).toContainText(/50\D?000/);
    await noHorizontalScroll(page);
  });

  test('EN : même contenu en anglais, avec le même code', async ({ page }) => {
    await signedUp(page);
    await page.goto('/fr/parrainage');
    const codeFr = (await page.getByTestId('referral-code').innerText()).trim();

    await page.goto('/en/referral');
    await expect(page.getByTestId('referral-code')).toHaveText(codeFr);
    await expect(page.getByTestId('referral-link')).toContainText(`ref=${codeFr}`);
    await expect(page.getByTestId('referral-explainer')).toContainText(/10[,\s]?000/);
    await expect(page.getByTestId('referral-explainer')).toContainText('500');
    await expect(page.getByTestId('discount-remaining')).toContainText(/50[,\s]?000/);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/parrainage/i);
    await noHorizontalScroll(page);
  });

  test('copier le code place le code dans le presse-papiers', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signedUp(page);
    await page.goto('/fr/parrainage');
    const code = (await page.getByTestId('referral-code').innerText()).trim();
    await page.getByTestId('referral-copy-code').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  });

  test('un visiteur non connecté est renvoyé vers la connexion', async ({ page }) => {
    await page.goto('/fr/parrainage');
    await expect(page).toHaveURL(/\/fr\/connexion/);
  });
});
