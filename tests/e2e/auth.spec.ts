import { expect, test, type Page } from '@playwright/test';

/*
 * Parcours comptes : inscription → déconnexion → connexion par téléphone → mot de passe oublié.
 * Prérequis : Supabase local démarré ; Turnstile en clés de test Cloudflare dans .env.local
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
 *   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
 * Sélecteurs attendus des formulaires (contrat avec lp-coder / lp-designer) :
 *   input[name=email|phone|password|identifier], [data-field=country|display_currency] (liste maison),
 *   bouton d'envoi = button[type=submit], retour = [role=alert] (erreur) / [role=status] (succès),
 *   bouton de déconnexion = [data-testid=logout].
 */

const PATHS = {
  fr: {
    register: '/fr/inscription',
    login: '/fr/connexion',
    privateHome: '/fr/tableau-de-bord',
    forgot: '/fr/mot-de-passe-oublie',
    home: /\/fr\/tableau-de-bord/,
  },
  en: {
    register: '/en/register',
    login: '/en/login',
    privateHome: '/en/dashboard',
    forgot: '/en/forgot-password',
    home: /\/en\/dashboard/,
  },
} as const;

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';

test.use({ viewport: { width: 360, height: 740 } });

async function waitTurnstile(page: Page) {
  // Le faux widget (clés de test) remplit ce champ caché tout seul.
  await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 15_000,
  });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// Zone privée : sans session, redirection vers la connexion de la même langue.
const PRIVATE = {
  fr: ['/fr/tableau-de-bord', '/fr/commander', '/fr/compte', '/fr/commandes', '/fr/recharger'],
  en: ['/en/dashboard', '/en/order', '/en/account', '/en/orders', '/en/add-funds'],
} as const;

for (const locale of ['fr', 'en'] as const) {
  test.describe(`zone privée déconnecté (${locale})`, () => {
    for (const path of PRIVATE[locale]) {
      test(`${path} renvoie vers ${PATHS[locale].login}`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(new RegExp(`${PATHS[locale].login}$`));
        await expect(page.locator('input[name="identifier"]')).toBeVisible();
      });
    }
    test("l'accueil, la connexion et l'inscription restent ouverts", async ({ page }) => {
      for (const path of [`/${locale}`, PATHS[locale].login, PATHS[locale].register]) {
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
      }
    });
  });
}

for (const locale of ['fr', 'en'] as const) {
  test.describe(`parcours comptes (${locale}, mobile 360 px)`, () => {
    const stamp = `${Date.now()}${locale === 'fr' ? 1 : 2}`;
    const email = `client-e2e-${stamp}@lyonpanel.test`;
    // +237 6 + 8 chiffres, unique par exécution et par langue.
    const phone = `+2376${stamp.slice(-8)}`;
    const p = PATHS[locale];

    test('inscription, déconnexion, connexion par téléphone', async ({ page }) => {
      await page.goto(p.register);
      await noHorizontalScroll(page);
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="phone"]').fill(phone);
      await page.locator('input[name="password"]').fill(PASSWORD);
      await page.locator('[data-field="country"]').click();
      await page.locator('[role="option"][data-value="CM"]').click();
      await page.locator('[data-field="display_currency"]').click();
      await page.locator('[role="option"][data-value="XAF"]').click();
      await waitTurnstile(page);
      await page.locator('button[type="submit"]').click();
      // Première visite du tableau de bord : compilation à froid de `next dev`.
      await expect(page).toHaveURL(p.home, { timeout: 45_000 });

      await page.locator('[data-testid="logout"]').click();
      await expect(page).not.toHaveURL(p.home);
      // Session fermée : la zone privée n'est plus accessible.
      await page.goto(p.privateHome);
      await expect(page).toHaveURL(new RegExp(`${p.login}$`));

      await page.goto(p.login);
      await noHorizontalScroll(page);
      await page.locator('input[name="identifier"]').fill(phone);
      await page.locator('input[name="password"]').fill(PASSWORD);
      await waitTurnstile(page);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(p.home);
    });

    test('un mauvais mot de passe affiche la même erreur que le compte existe ou non', async ({
      page,
    }) => {
      const messages: string[] = [];
      for (const identifier of [phone, '+237699999999']) {
        await page.goto(p.login);
        await page.locator('input[name="identifier"]').fill(identifier);
        await page.locator('input[name="password"]').fill('Mauvais-mdp-12345');
        await waitTurnstile(page);
        await page.locator('button[type="submit"]').click();
        const alert = page.getByRole('alert');
        await expect(alert).toBeVisible();
        messages.push((await alert.innerText()).trim());
      }
      expect(messages[0]).toBe(messages[1]);
    });

    test('mot de passe oublié : même message pour un email connu et inconnu', async ({ page }) => {
      const messages: string[] = [];
      for (const address of [email, `inconnu-${stamp}@lyonpanel.test`]) {
        await page.goto(p.forgot);
        await noHorizontalScroll(page);
        await page.locator('input[name="email"]').fill(address);
        await waitTurnstile(page);
        await page.locator('button[type="submit"]').click();
        const status = page.getByRole('status');
        await expect(status).toBeVisible();
        messages.push((await status.innerText()).trim());
      }
      expect(messages[0]).toBe(messages[1]);
    });
  });
}
