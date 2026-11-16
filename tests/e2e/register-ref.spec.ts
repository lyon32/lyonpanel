import { expect, test } from '@playwright/test';

// Régression : avec ?ref=CODE, le formulaire est remonté après l'hydratation ; le widget
// Turnstile doit quand même s'afficher (sinon l'inscription est impossible).
// Prérequis : NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA (clé de test Cloudflare).
test('inscription via ?ref : Turnstile s affiche et le code est pré-rempli', async ({ page }) => {
  await page.goto('/fr/inscription?ref=ABCD1234');
  await expect(
    page.locator('input[name="referral_code"], input[name="referralCode"]').first(),
  ).toHaveValue('ABCD1234');
  await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 15_000,
  });
});
