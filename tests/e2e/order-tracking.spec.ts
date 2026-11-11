import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { makeService } from '../factories/service';

/*
 * Suivi de commande, faux fournisseur (PROVIDER_MODE=mock), aucun vrai argent.
 * Prérequis : ceux de order.spec.ts, plus dans le serveur ET ce processus :
 *   CRON_SECRET=<valeur>, TEST_ROUTE_SECRET=<valeur>.
 * Routes utilisées :
 *   GET  /api/cron/orders                       (Authorization: Bearer CRON_SECRET) ;
 *   POST /api/test/provider/force-status        (x-test-secret = TEST_ROUTE_SECRET) { providerOrderId, status }.
 * Éléments à fournir (lp-designer) sur /fr/orders :
 *   order-row (une ligne par commande, data-status), order-status-badge (data-status + libellé).
 */

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
const CRON = process.env.CRON_SECRET ?? '';
const TEST_SECRET = process.env.TEST_ROUTE_SECRET ?? '';
const LINK = 'https://www.tiktok.com/@client_e2e/video/7300000000000000000';

test.use({ viewport: { width: 360, height: 740 } });

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
  );

let counter = 0;
async function signedUp(page: Page): Promise<string> {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const email = `client-trk-${stamp}@lyonpanel.test`;
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

async function orderOnce(page: Page): Promise<{ providerOrderId: number }> {
  const service = await makeService({
    price_xaf_1000: 1155,
    cost_usd_1000: 0.385,
    min_qty: 10,
    max_qty: 10_000,
  });
  const email = await signedUp(page);
  const db = admin();
  const { data: profile } = await db.from('profiles').select('id').eq('email', email).single();
  await db.from('wallets').update({ balance_xaf: 5000 }).eq('user_id', profile!.id);

  await page.goto(`/fr/commander?service=${service.id}`);
  await page.locator('[data-testid="order-link"]').fill(LINK);
  await page.locator('[data-testid="order-quantity"]').fill('1000');
  await expect(page.locator('[data-testid="quote-total"]')).toContainText(/1\D?155/);
  await page.locator('[data-testid="order-submit"]').click();
  await expect(page.locator('[data-testid="order-result"]')).toHaveAttribute(
    'data-status',
    'in_progress',
    { timeout: 20_000 },
  );
  const { data: order } = await db
    .from('orders')
    .select('provider_order_id')
    .eq('user_id', profile!.id)
    .single();
  return { providerOrderId: Number(order!.provider_order_id) };
}

async function runCron(page: Page): Promise<void> {
  const res = await page.request.get('/api/cron/orders', {
    headers: { authorization: `Bearer ${CRON}` },
  });
  expect(res.status()).toBe(200);
}

test.describe('suivi des commandes', () => {
  test('la page /orders passe seule à « terminée » après le cron, sans rechargement', async ({
    page,
  }) => {
    await orderOnce(page);
    await page.goto('/fr/orders');
    const badge = page.locator('[data-testid="order-status-badge"]').first();
    await expect(badge).toHaveAttribute('data-status', 'in_progress');

    // Le faux fournisseur avance d un pas par appel : quelques passages suffisent.
    for (let i = 0; i < 4; i += 1) await runCron(page);

    // Aucun page.reload()/goto : la page se met à jour toute seule (suivi toutes les 30 s).
    await expect(badge).toHaveAttribute('data-status', 'completed', { timeout: 45_000 });
    await expect(badge).toContainText(/termin/i);
  });

  test('commande partielle : « en cours de vérification », aucun détail technique', async ({
    page,
  }) => {
    const { providerOrderId } = await orderOnce(page);
    const force = await page.request.post('/api/test/provider/force-status', {
      headers: { 'x-test-secret': TEST_SECRET },
      data: { providerOrderId, status: 'Partial' },
    });
    expect(force.status()).toBe(200);

    await page.goto('/fr/orders');
    await runCron(page);

    const badge = page.locator('[data-testid="order-status-badge"]').first();
    await expect(badge).toHaveAttribute('data-status', 'to_review', { timeout: 45_000 });
    await expect(badge).toContainText(/en cours de vérification/i);
    await expect(page.locator('body')).not.toContainText(/JAP|provider|fournisseur|partial/i);
  });
});
