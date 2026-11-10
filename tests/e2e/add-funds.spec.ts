import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/*
 * Recharge SasPay en mode test (faux SasPay, aucun vrai paiement).
 * Prérequis : ceux de auth.spec.ts (Supabase local, Turnstile de test) et un serveur lancé avec
 *   SASPAY_MODE=test, SASPAY_API_KEY vide, SASPAY_WEBHOOK_SECRET=<même valeur que dans ce processus>.
 * Les webhooks sont signés ici avec ce secret (SASPAY_WEBHOOK_SECRET), comme le ferait SasPay.
 *
 * Éléments de page attendus (data-testid), à fournir par lp-designer :
 *   /fr/recharger        : amount-input, quote-fee, quote-total, pay-submit
 *   /fr/recharger/<id>   : payment-status (attribut data-status = pending | succeeded | failed), wallet-balance
 */

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
const WEBHOOK_SECRET = process.env.SASPAY_WEBHOOK_SECRET ?? '';
const AMOUNT = /3\D?000/;

test.use({ viewport: { width: 360, height: 740 } });
test.beforeAll(() => {
  if (!WEBHOOK_SECRET)
    throw new Error('SASPAY_WEBHOOK_SECRET doit être défini pour signer les webhooks');
});

let counter = 0;
async function signedUp(page: Page): Promise<void> {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  await page.goto('/fr/inscription');
  await page.locator('input[name="email"]').fill(`client-pay-${stamp}@lyonpanel.test`);
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

/** Envoie un webhook SasPay signé (même calcul que docs/06-saspay.md §3). */
async function sendWebhook(
  request: APIRequestContext,
  paymentId: string,
  event = 'transaction.success',
) {
  const rawBody = JSON.stringify({
    event,
    data: {
      id: `txn_e2e_${paymentId}`,
      reference: `ref_e2e_${paymentId}`,
      status: event === 'transaction.success' ? 'SUCCESS' : 'FAILED',
      amount: '3000.00',
      fee: '90.00',
      charged: '3090.00',
      net_amount: '3000.00',
      fee_charge_mode: 'ADD_ON',
      currency: 'XAF',
      country: 'CM',
      network: 'mtn_cm',
      metadata: { lyonpanel_payment_id: paymentId },
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return request.post('/api/webhooks/saspay', {
    data: rawBody,
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
      'x-webhook-event': event,
    },
  });
}

async function startRecharge(page: Page): Promise<string> {
  const res = await page.request.post('/api/v1/payments', {
    data: { amount_xaf: 3000 },
    headers: {
      'idempotency-key': crypto.randomUUID(),
      origin: new URL(page.url()).origin,
    },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test.describe('page de recharge', () => {
  test('affiche les frais en plus avant de payer (3 000 XAF -> 90 XAF de frais, 3 090 XAF à payer)', async ({
    page,
  }) => {
    await signedUp(page);
    await page.goto('/fr/recharger');
    await page.locator('[data-testid="amount-input"]').fill('3000');
    await expect(page.locator('[data-testid="quote-fee"]')).toContainText(/90/);
    await expect(page.locator('[data-testid="quote-total"]')).toContainText(/3\D?090/);
  });

  test('refuse un montant sous le minimum (499 XAF) sans envoyer de paiement', async ({ page }) => {
    await signedUp(page);
    await page.goto('/fr/recharger');
    let sent = false;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/v1/payments')) sent = true;
    });
    await page.locator('[data-testid="amount-input"]').fill('499');
    await page.locator('[data-testid="pay-submit"]').click();
    await expect(page.getByText(/500/)).toBeVisible();
    expect(sent).toBe(false);
  });

  test('le bouton Payer envoie le montant seul, avec une clé d idempotence', async ({ page }) => {
    await signedUp(page);
    await page.goto('/fr/recharger');
    await page.locator('[data-testid="amount-input"]').fill('3000');
    const requested = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/api/v1/payments'),
    );
    await page.locator('[data-testid="pay-submit"]').click();
    const req = await requested;
    expect(req.headers()['idempotency-key']).toBeTruthy();
    expect(req.postDataJSON()).toEqual({ amount_xaf: 3000 });
  });
});

test.describe('page de retour', () => {
  test('passe de « en attente » à « crédité » quand le webhook arrive, 3 000 XAF au solde', async ({
    page,
  }) => {
    await signedUp(page);
    const id = await startRecharge(page);

    await page.goto(`/fr/recharger/${id}`);
    await expect(page.locator('[data-testid="payment-status"]')).toHaveAttribute(
      'data-status',
      'pending',
    );

    const res = await sendWebhook(page.request, id);
    expect(res.status()).toBe(200);

    // La page se rafraîchit toute seule (toutes les 5 s) : aucun rechargement manuel.
    await expect(page.locator('[data-testid="payment-status"]')).toHaveAttribute(
      'data-status',
      'succeeded',
      { timeout: 20_000 },
    );
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(AMOUNT);
  });

  test('webhook renvoyé 3 fois : le solde reste à 3 000 XAF', async ({ page }) => {
    await signedUp(page);
    const id = await startRecharge(page);

    for (let i = 0; i < 3; i++) expect((await sendWebhook(page.request, id)).status()).toBe(200);

    await page.goto(`/fr/recharger/${id}`);
    await expect(page.locator('[data-testid="payment-status"]')).toHaveAttribute(
      'data-status',
      'succeeded',
    );
    await expect(page.locator('[data-testid="wallet-balance"]')).toContainText(AMOUNT);
    await expect(page.locator('[data-testid="wallet-balance"]')).not.toContainText(
      /6\D?000|9\D?000/,
    );
  });

  test('un paiement échoué affiche « échoué » et ne crédite rien', async ({ page }) => {
    await signedUp(page);
    const id = await startRecharge(page);
    expect((await sendWebhook(page.request, id, 'transaction.failed')).status()).toBe(200);

    await page.goto(`/fr/recharger/${id}`);
    await expect(page.locator('[data-testid="payment-status"]')).toHaveAttribute(
      'data-status',
      'failed',
    );
    await expect(page.locator('[data-testid="wallet-balance"]')).not.toContainText(AMOUNT);
  });

  test('un webhook à signature fausse est refusé (403) et ne crédite rien', async ({
    page,
    request,
  }) => {
    await signedUp(page);
    const id = await startRecharge(page);
    const res = await request.post('/api/webhooks/saspay', {
      data: JSON.stringify({
        event: 'transaction.success',
        data: { id: 'txn_x', metadata: { lyonpanel_payment_id: id } },
      }),
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': 'f'.repeat(64),
        'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-webhook-event': 'transaction.success',
      },
    });
    expect(res.status()).toBe(403);
    await page.goto(`/fr/recharger/${id}`);
    await expect(page.locator('[data-testid="payment-status"]')).toHaveAttribute(
      'data-status',
      'pending',
    );
  });
});
