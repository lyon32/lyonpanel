import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';

/*
 * Espace client à 360 px (phase 8), faux fournisseur et faux SasPay, aucun vrai argent.
 * Prérequis : ceux de order.spec.ts (Supabase local 55321, clés Turnstile de test, PROVIDER_MODE=mock).
 * Éléments à fournir (lp-designer, 8.4), tous data-testid :
 *   dashboard : stat-card (exactement 4), suggestion-card (+ suggestion-order, suggestion-dismiss, suggestion-disable),
 *               header-balance (solde de l'en-tête, jamais « — »), new-order-button (une seule ligne de texte)
 *   menu du bas : nav « Menu du bas » avec 4 liens (Commander, Commandes, Recharger, Compte)
 *   compte : account-currency (select), account-language (select), account-phone (input), account-save (ActionButton),
 *            account-delete (ouvre un dialogue), delete-password (input), delete-confirm (ActionButton)
 *   favoris : favorite-row (une par favori), favorite-remove ; transactions : transaction-row, transactions-filter
 * Règles vérifiées : aucun débordement horizontal, cibles tactiles >= 44 px, aucun mot « fournisseur ».
 */

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
test.use({ viewport: { width: 360, height: 740 } });

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
  );

// Écrit une ligne de journal (préparation seulement). Importé en local : Playwright ne charge pas next/server.
async function makeTransaction(
  userId: string,
  row: { type: string; amount_xaf: number; balance_after_xaf: number },
) {
  const { error } = await admin()
    .from('wallet_transactions')
    .insert({ user_id: userId, ref: `e2e-${Date.now()}-${Math.random()}`, ...row });
  if (error) throw new Error(error.message);
}

let counter = 0;
async function signedUp(page: Page): Promise<{ id: string; email: string }> {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const email = `client-area-${stamp}@lyonpanel.test`;
  await page.goto('/fr/inscription');
  await page.locator('input[name="email"]').fill(email);
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
  await expect(page).toHaveURL(/\/fr\/tableau-de-bord/, { timeout: 45_000 });
  const { data } = await admin().from('profiles').select('id').eq('email', email).single();
  return { id: data!.id as string, email };
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function tapTargetsAreBigEnough(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a, button, [role="button"], select, input')]
      .filter((el) => el.offsetParent !== null && el.getAttribute('type') !== 'hidden')
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44))
      .map(
        ({ el }) =>
          `${el.tagName} ${el.getAttribute('data-testid') ?? el.textContent?.trim().slice(0, 20)}`,
      ),
  );
  expect(small).toEqual([]);
}

async function noProviderWord(page: Page) {
  const text = (await page.locator('body').innerText()).toLowerCase();
  expect(text).not.toMatch(/fournisseur|provider/);
}

test.describe('Espace client à 360 px', () => {
  test('tableau de bord : 4 cartes, solde visible, bouton sur une ligne, menu du bas, sans débordement', async ({
    page,
  }) => {
    const user = await signedUp(page);
    await admin().from('wallets').update({ balance_xaf: 4200 }).eq('user_id', user.id);
    await page.goto('/fr/tableau-de-bord');

    await expect(page.locator('[data-testid="stat-card"]')).toHaveCount(4);
    const balance = page.locator('[data-testid="header-balance"]');
    await expect(balance).toContainText(/4\D?200/);
    await expect(balance).not.toContainText('—');

    const button = page.locator('[data-testid="new-order-button"]');
    // Nombre de lignes de texte réellement affichées (positions verticales distinctes des mots).
    const lines = await button.evaluate((el) => {
      const tops = new Set<number>();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) tops.add(Math.round(r.top));
      }
      return tops.size;
    });
    expect(lines).toBe(1);

    const nav = page.getByRole('navigation', { name: 'Menu du bas' });
    await expect(nav.getByRole('link')).toHaveCount(4);
    for (const name of ['Commander', 'Commandes', 'Recharger', 'Compte']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    await noHorizontalOverflow(page);
    await tapTargetsAreBigEnough(page);
    await noProviderWord(page);
  });

  test('client sans commande : pas de carte de suggestion', async ({ page }) => {
    await signedUp(page);
    await page.goto('/fr/tableau-de-bord');
    await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-card"]')).toHaveCount(0);
  });

  test('client avec commandes : suggestion pré-remplie, fermable, puis désactivable pour de bon', async ({
    page,
    browser,
  }) => {
    const user = await signedUp(page);
    const service = await makeService({ min_qty: 10, max_qty: 10_000 });
    await makeOrder(user.id, service.id, { quantity: 500 });
    await makeOrder(user.id, service.id, { quantity: 500 });
    await page.goto('/fr/tableau-de-bord');

    const card = page.locator('[data-testid="suggestion-card"]');
    await expect(card).toBeVisible();
    await noProviderWord(page);

    // Commander ouvre le formulaire déjà rempli.
    await page.locator('[data-testid="suggestion-order"]').click();
    await expect(page).toHaveURL(new RegExp(`service=${service.id}`));
    await expect(page.locator('[data-testid="order-quantity"]')).toHaveValue('500');

    // La croix ferme la carte ; elle revient au rechargement.
    await page.goto('/fr/tableau-de-bord');
    await page.locator('[data-testid="suggestion-dismiss"]').click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(card).toBeVisible();

    // « Ne plus afficher » : enregistré en base, donc absent après rechargement ET dans un autre navigateur.
    await page.locator('[data-testid="suggestion-disable"]').click();
    await expect(card).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await admin().from('profiles').select('suggestions_enabled').eq('id', user.id).single())
            .data?.suggestions_enabled,
      )
      .toBe(false);
    await page.reload();
    await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible();
    await expect(card).toHaveCount(0);

    const other = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page2 = await other.newPage();
    await page2.goto('/fr/connexion');
    await page2.locator('input[name="identifier"]').fill(user.email);
    await page2.locator('input[name="password"]').fill(PASSWORD);
    await expect(page2.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
      timeout: 15_000,
    });
    await page2.locator('button[type="submit"]').click();
    await expect(page2).toHaveURL(/\/fr\/tableau-de-bord/, { timeout: 45_000 });
    await expect(page2.locator('[data-testid="stat-card"]').first()).toBeVisible();
    await expect(page2.locator('[data-testid="suggestion-card"]')).toHaveCount(0);
    await other.close();
  });

  test('compte : change devise et téléphone avec les états loading puis success', async ({
    page,
  }) => {
    const user = await signedUp(page);
    await page.goto('/fr/compte');
    await page.locator('[data-testid="account-currency"]').selectOption('USD');
    const phone = `+22570${String(Date.now()).slice(-8)}`;
    await page.locator('[data-testid="account-phone"]').fill(phone);
    const save = page.locator('[data-testid="account-save"]');
    await save.click();
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await expect(save).toBeDisabled();
    await expect(save).not.toHaveAttribute('aria-busy', 'true', { timeout: 5000 });
    const { data } = await admin()
      .from('profiles')
      .select('display_currency, phone')
      .eq('id', user.id)
      .single();
    expect(data).toEqual({ display_currency: 'USD', phone });
    await noHorizontalOverflow(page);
    await tapTargetsAreBigEnough(page);
  });

  test('compte : un téléphone invalide affiche une erreur et ne change rien', async ({ page }) => {
    const user = await signedUp(page);
    const before = (await admin().from('profiles').select('phone').eq('id', user.id).single())
      .data!;
    await page.goto('/fr/compte');
    await page.locator('[data-testid="account-phone"]').fill('abc');
    await page.locator('[data-testid="account-save"]').click();
    await expect(page.getByRole('alert')).toBeVisible();
    const after = (await admin().from('profiles').select('phone').eq('id', user.id).single()).data!;
    expect(after.phone).toBe(before.phone);
  });

  test('compte : suppression refusée avec un mauvais mot de passe, acceptée avec le bon (solde conservé)', async ({
    page,
  }) => {
    const user = await signedUp(page);
    await admin().from('wallets').update({ balance_xaf: 2500 }).eq('user_id', user.id);
    await page.goto('/fr/compte');
    await page.locator('[data-testid="account-delete"]').click();
    await page.locator('[data-testid="delete-password"]').fill('Mauvais-mot-de-passe-1');
    await page.locator('[data-testid="delete-confirm"]').click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(
      (await admin().from('profiles').select('status').eq('id', user.id).single()).data!.status,
    ).toBe('active');

    await page.locator('[data-testid="delete-password"]').fill(PASSWORD);
    await page.locator('[data-testid="delete-confirm"]').click();
    await expect(page).not.toHaveURL(/compte/, { timeout: 15_000 });
    const profile = (
      await admin().from('profiles').select('status, email').eq('id', user.id).single()
    ).data!;
    expect(profile).toEqual({ status: 'deleted', email: null });
    const wallet = (
      await admin().from('wallets').select('balance_xaf').eq('user_id', user.id).single()
    ).data!;
    expect(Number(wallet.balance_xaf)).toBe(2500);
  });

  test('favoris : liste, retrait avec retour visuel, sans débordement', async ({ page }) => {
    const user = await signedUp(page);
    const service = await makeService();
    await admin().from('favorites').insert({ user_id: user.id, service_id: service.id });
    await page.goto('/fr/favoris');
    const rows = page.locator('[data-testid="favorite-row"]');
    await expect(rows).toHaveCount(1);
    await noHorizontalOverflow(page);
    await tapTargetsAreBigEnough(page);
    await noProviderWord(page);
    await rows.first().locator('[data-testid="favorite-remove"]').click();
    await expect(rows).toHaveCount(0);
    const { data } = await admin().from('favorites').select('*').eq('user_id', user.id);
    expect(data).toHaveLength(0);
  });

  test('transactions : liste ses mouvements, filtre par type, sans débordement', async ({
    page,
  }) => {
    const user = await signedUp(page);
    await makeTransaction(user.id, { type: 'recharge', amount_xaf: 3000, balance_after_xaf: 3000 });
    await makeTransaction(user.id, {
      type: 'adjustment',
      amount_xaf: 500,
      balance_after_xaf: 3500,
    });
    await page.goto('/fr/transactions');
    const rows = page.locator('[data-testid="transaction-row"]');
    await expect(rows).toHaveCount(2);
    await noHorizontalOverflow(page);
    await tapTargetsAreBigEnough(page);
    await page.locator('[data-testid="transactions-filter"]').selectOption('recharge');
    await expect(rows).toHaveCount(1);
  });
});
