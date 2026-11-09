import { expect, test, type Browser, type Page } from '@playwright/test';

/*
 * Parcours comptes complémentaires : blocage progressif, réinitialisation avec lien conservé,
 * lien non rejouable. Prérequis : ceux de auth.spec.ts + Mailpit local (Supabase).
 * MAILPIT_URL : adresse de l'API Mailpit (défaut http://127.0.0.1:55324).
 */

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:55324';
const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
const NEW_PASSWORD = 'Zt7#pLw4!nQx-92Kd';

const PATHS = {
  fr: {
    register: '/fr/inscription',
    login: '/fr/connexion',
    forgot: '/fr/mot-de-passe-oublie',
    home: /\/fr\/tableau-de-bord/,
    lockedText: /Trop de tentatives.*15 min/,
    linkPattern: /\/fr\/nouveau-mot-de-passe\?[^"\s<]*token_hash=[^"\s<]+/,
    commonText: /trop courant/,
    invalidText: /invalide ou a expiré/,
  },
  en: {
    register: '/en/register',
    login: '/en/login',
    forgot: '/en/forgot-password',
    home: /\/en\/dashboard/,
    lockedText: /Too many attempts.*15 min/,
    linkPattern: /\/en\/reset-password\?[^"\s<]*token_hash=[^"\s<]+/,
    commonText: /too common/,
    invalidText: /invalid or has expired/,
  },
} as const;

type Locale = keyof typeof PATHS;

test.use({ viewport: { width: 360, height: 740 } });

let counter = 0;
function uniqueUser(tag: string) {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  return {
    email: `client-${tag}-${stamp}@lyonpanel.test`,
    phone: `+2376${stamp.slice(-8)}`,
  };
}

async function waitTurnstile(page: Page) {
  await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 15_000,
  });
}

async function register(page: Page, locale: Locale, user: { email: string; phone: string }) {
  await page.goto(PATHS[locale].register);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="phone"]').fill(user.phone);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('select[name="country"]').selectOption('CM');
  await page.locator('select[name="display_currency"]').selectOption('XAF');
  await waitTurnstile(page);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(PATHS[locale].home, { timeout: 45_000 });
  await page.locator('[data-testid="logout"]').click();
  await expect(page).not.toHaveURL(PATHS[locale].home);
}

async function login(page: Page, locale: Locale, identifier: string, password: string) {
  await page.goto(PATHS[locale].login);
  await page.locator('input[name="identifier"]').fill(identifier);
  await page.locator('input[name="password"]').fill(password);
  await waitTurnstile(page);
  await page.locator('button[type="submit"]').click();
}

/** Attend (boucle avec délai maximum) le lien de réinitialisation reçu par cette adresse. */
async function waitResetLink(locale: Locale, email: string): Promise<string> {
  let link: string | null = null;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        const list = (await search.json()) as { messages?: { ID: string }[] };
        const id = list.messages?.[0]?.ID;
        if (!id) return false;
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
          HTML?: string;
        };
        const found = PATHS[locale].linkPattern.exec(msg.HTML ?? '');
        link = found ? found[0].replaceAll('&amp;', '&') : null;
        return link !== null;
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
  if (!link) throw new Error('Lien de réinitialisation introuvable');
  return link;
}

async function requestReset(page: Page, locale: Locale, email: string) {
  await page.goto(PATHS[locale].forgot);
  await page.locator('input[name="email"]').fill(email);
  await waitTurnstile(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('status')).toBeVisible();
}

for (const locale of ['fr', 'en'] as const) {
  test(`blocage progressif : la 4e tentative est refusée même avec le bon mot de passe (${locale})`, async ({
    page,
  }) => {
    const user = uniqueUser(`lock-${locale}`);
    await register(page, locale, user);

    for (let i = 0; i < 3; i += 1) {
      await login(page, locale, user.email, `Mauvais-mdp-${i}-12345`);
      await expect(page.locator('p[role="alert"]')).toBeVisible();
      await expect(page.locator('p[role="alert"]')).not.toContainText(PATHS[locale].lockedText);
    }

    await login(page, locale, user.email, PASSWORD);
    await expect(page.locator('p[role="alert"]')).toContainText(PATHS[locale].lockedText);
    await expect(page).not.toHaveURL(PATHS[locale].home);
  });
}

async function openInFreshContext(browser: Browser, url: string) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}

test.describe.serial('réinitialisation (fr)', () => {
  const locale: Locale = 'fr';
  const user = uniqueUser('reset');
  let link = '';

  test('lien conservé après un mot de passe refusé, puis connexion avec le nouveau', async ({
    page,
  }) => {
    await register(page, locale, user);
    await requestReset(page, locale, user.email);
    link = await waitResetLink(locale, user.email);

    await page.goto(link);
    await page.locator('input[name="new_password"]').fill('password1');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(PATHS[locale].commonText)).toBeVisible();
    await expect(page).toHaveURL(/nouveau-mot-de-passe/);

    // Même page, même lien : un bon mot de passe passe.
    await page.locator('input[name="new_password"]').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`${PATHS[locale].login}`), { timeout: 20_000 });

    await login(page, locale, user.email, NEW_PASSWORD);
    await expect(page).toHaveURL(PATHS[locale].home, { timeout: 45_000 });
  });

  test('le même lien rouvert dans un contexte neuf est refusé', async ({ browser }) => {
    expect(link).not.toBe('');
    const { context, page } = await openInFreshContext(browser, link);
    await page.locator('input[name="new_password"]').fill(NEW_PASSWORD + 'x');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('p[role="alert"]')).toContainText(PATHS[locale].invalidText);
    await expect(page).not.toHaveURL(new RegExp(PATHS[locale].login));
    await context.close();
  });
});
