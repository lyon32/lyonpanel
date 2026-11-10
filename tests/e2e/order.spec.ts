import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { makeService } from '../factories/service';

/*
 * Parcours de commande, faux fournisseur (PROVIDER_MODE=mock), aucun vrai argent.
 * Prérequis : ceux de add-funds.spec.ts (Supabase local, Turnstile de test) et un serveur lancé avec
 *   PROVIDER_MODE=mock, SASPAY_WEBHOOK_SECRET=<même valeur que dans ce processus>, SUPABASE_SERVICE_ROLE_KEY.
 * Le faux fournisseur du serveur est dans son processus : le test le règle via une route réservée au mode test
 *   POST /api/test/provider/fail-next  (en-tête x-test-secret = SASPAY_WEBHOOK_SECRET) -> 200
 * le prochain provider.add du serveur échoue (une seule fois). Répond 404 hors mode mock.
 * Le solde de départ est préparé avec la clé de service (écriture de test seulement, comme tests/db).
 *
 * Page /fr/commander?service=<id> (service présélectionné), éléments data-testid à fournir par lp-designer :
 *   order-service (nom du service choisi), order-link (champ lien), order-quantity (champ quantité),
 *   order-comments (zone, seulement pour un service « commentaires »), quote-total, quote-balance-after,
 *   order-submit (bouton Commander), order-progress (data-step = sending | debiting | submitting | done),
 *   order-result (data-status = in_progress | to_review), order-error (message d'erreur),
 *   missing-balance (« Il vous manque X XAF »), topup-link (lien vers /fr/recharger),
 *   wallet-balance (solde affiché dans l'en-tête / la page).
 */

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
const SECRET = process.env.SASPAY_WEBHOOK_SECRET ?? '';
const LINK = 'https://www.tiktok.com/@client_e2e/video/7300000000000000000';

test.use({ viewport: { width: 360, height: 740 } });

let counter = 0;
async function signedUp(page: Page): Promise<string> {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const email = `client-ord-${stamp}@lyonpanel.test`;
  await page.goto('/fr/inscription');
  await page.locator('input[name="email"]').fill(email);
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
  return email;
}

async function fund(email: string, balanceXaf: number): Promise<void> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
  );
  const { data } = await db.from('profiles').select('id').eq('email', email).single();
  const { error } = await db
    .from('wallets')
    .update({ balance_xaf: balanceXaf })
    .eq('user_id', data!.id);
  expect(error).toBeNull();
}

async function fillOrder(page: Page, serviceId: number, quantity: string) {
  await page.goto(`/fr/commander?service=${serviceId}`);
  await page.locator('[data-testid="order-link"]').fill(LINK);
  await page.locator('[data-testid="order-quantity"]').fill(quantity);
}

async function newService() {
  return makeService({ price_xaf_1000: 1155, cost_usd_1000: 0.385, min_qty: 10, max_qty: 10_000 });
}

test.describe('commande', () => {
  test('parcours complet : devis 1 155 XAF, commande, progression, statut en cours, solde 5 000 -> 3 845', async ({
    page,
  }) => {
    const service = await newService();
    const email = await signedUp(page);
    await fund(email, 5000);

    await fillOrder(page, service.id, '1000');
    // Devis en direct (anti-rebond 300 ms) : calculé par le serveur.
    await expect(page.locator('[data-testid="quote-total"]')).toContainText(/1\D?155/);
    await expect(page.locator('[data-testid="quote-balance-after"]')).toContainText(/3\D?845/);

    await page.locator('[data-testid="order-submit"]').click();
    await expect(page.locator('[data-testid="order-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-result"]')).toHaveAttribute(
      'data-status',
      'in_progress',
      { timeout: 20_000 },
    );
    // Solde affiché mis à jour juste après la commande, sans changer de page.
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/3\D?845/);
    await page.goto('/fr/commander');
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/3\D?845/);
  });

  test('solde insuffisant : « Il vous manque 155 XAF » et un bouton vers la recharge, aucun débit', async ({
    page,
  }) => {
    const service = await newService();
    const email = await signedUp(page);
    await fund(email, 1000);

    await fillOrder(page, service.id, '1000');
    await expect(page.locator('[data-testid="quote-total"]')).toContainText(/1\D?155/);
    await expect(page.locator('[data-testid="missing-balance"]')).toContainText(
      /Il vous manque 155 XAF/,
    );
    await expect(page.locator('[data-testid="topup-link"]')).toHaveAttribute(
      'href',
      /\/fr\/recharger/,
    );
    await page.goto('/fr/commander');
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/1\D?000/);
  });

  test('double clic sur Commander : une seule commande, un seul débit', async ({ page }) => {
    const service = await newService();
    const email = await signedUp(page);
    await fund(email, 5000);

    await fillOrder(page, service.id, '1000');
    await expect(page.locator('[data-testid="quote-total"]')).toContainText(/1\D?155/);
    await page.locator('[data-testid="order-submit"]').dblclick();
    await expect(page.locator('[data-testid="order-result"]')).toHaveAttribute(
      'data-status',
      'in_progress',
      { timeout: 20_000 },
    );
    // Le solde affiché est mis à jour sans recharger la page.
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/3\D?845/);

    await page.goto('/fr/commander');
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/3\D?845/);
    const list = await page.request.get('/api/v1/orders');
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(1);
  });

  test('échec du fournisseur : « en cours de vérification », aucun message technique, solde toujours débité', async ({
    page,
  }) => {
    const service = await newService();
    const email = await signedUp(page);
    await fund(email, 5000);
    const arm = await page.request.post('/api/test/provider/fail-next', {
      headers: { 'x-test-secret': SECRET },
    });
    expect(arm.status()).toBe(200);

    await fillOrder(page, service.id, '1000');
    await expect(page.locator('[data-testid="quote-total"]')).toContainText(/1\D?155/);
    await page.locator('[data-testid="order-submit"]').click();

    const result = page.locator('[data-testid="order-result"]');
    await expect(result).toHaveAttribute('data-status', 'to_review', { timeout: 20_000 });
    await expect(result).toContainText(/en cours de vérification/i);
    await expect(page.locator('body')).not.toContainText(/JAP|provider|fournisseur/i);
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/3\D?845/);

    await page.goto('/fr/commander');
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/3\D?845/);
  });

  test('lien d une autre plateforme : message clair, aucun débit', async ({ page }) => {
    const service = await newService();
    const email = await signedUp(page);
    await fund(email, 5000);

    await page.goto(`/fr/commander?service=${service.id}`);
    await page.locator('[data-testid="order-link"]').fill('https://www.instagram.com/p/Cabc/');
    await page.locator('[data-testid="order-quantity"]').fill('1000');
    await page.locator('[data-testid="order-submit"]').click();
    await expect(page.locator('[data-testid="order-error"]')).toContainText(/lien/i);
    await page.goto('/fr/commander');
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(/5\D?000/);
  });

  test('360 px : pas de défilement horizontal et le bouton Commander reste atteignable', async ({
    page,
  }) => {
    const service = await newService();
    const email = await signedUp(page);
    await fund(email, 5000);
    await fillOrder(page, service.id, '1000');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const submit = page.locator('[data-testid="order-submit"]');
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
