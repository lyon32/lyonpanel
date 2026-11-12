import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';

/*
 * Support à 360 px (phase 9) : ouvrir un ticket avec une capture, voir le fil, répondre, fermer.
 * Prérequis : ceux de client-area.spec.ts (Supabase local, clés Turnstile de test, PROVIDER_MODE=mock).
 * Éléments à fournir (data-testid) :
 *   /support : faq-item (exactement 5), ticket-form, ticket-subject (select), ticket-order (select, sujet « order »),
 *              ticket-body, ticket-attach (input file), attachment-chip, ticket-submit, ticket-row (une par ticket),
 *              texte « 24 h »
 *   /support/<id> : ticket-message ([data-from-admin]), ticket-attachment, ticket-reply-body, ticket-reply-send,
 *              ticket-close, ticket-closed-notice
 * Règles vérifiées : aucun débordement horizontal, cibles tactiles >= 44 px, aucun mot « fournisseur ».
 */

const PASSWORD = 'Cf9!vQ2#zLm7-rTa84';
test.use({ viewport: { width: 360, height: 740 } });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
  );

let counter = 0;
async function signedUp(page: Page): Promise<{ id: string; email: string }> {
  counter += 1;
  const stamp = `${Date.now()}${counter}`;
  const email = `support-${stamp}@lyonpanel.test`;
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
  expect(text).not.toMatch(/fournisseur|provider|\bjap\b/);
}

async function openTicket(page: Page, subject: string, body: string, withImage = false) {
  await page.goto('/fr/support');
  await page.locator('[data-testid="ticket-subject"]').selectOption(subject);
  await page.locator('[data-testid="ticket-body"]').fill(body);
  if (withImage) {
    await page
      .locator('[data-testid="ticket-attach"]')
      .setInputFiles({ name: 'capture.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('[data-testid="attachment-chip"]')).toHaveCount(1, {
      timeout: 15_000,
    });
  }
  await page.locator('[data-testid="ticket-submit"]').click();
  await expect(page).toHaveURL(/\/fr\/support\/[0-9a-f-]{36}/, { timeout: 20_000 });
  return page.url().split('/').pop()!;
}

test.describe('Support à 360 px', () => {
  test('page Support : 5 questions, délai de 24 h, formulaire, sans débordement', async ({
    page,
  }) => {
    await signedUp(page);
    await page.goto('/fr/support');
    await expect(page.locator('[data-testid="faq-item"]')).toHaveCount(5);
    await expect(page.locator('body')).toContainText(/24\s?h/);
    await expect(page.locator('[data-testid="ticket-form"]')).toBeVisible();
    // Aucun lien Telegram ou WhatsApp pour le client (décision du propriétaire).
    expect(
      await page.locator('a[href*="t.me"], a[href*="telegram"], a[href*="wa.me"]').count(),
    ).toBe(0);
    await noHorizontalOverflow(page);
    await tapTargetsAreBigEnough(page);
    await noProviderWord(page);
  });

  test('ouvre un ticket avec une capture, voit le fil, puis le ferme', async ({ page }) => {
    const user = await signedUp(page);
    const id = await openTicket(page, 'recharge', 'Ma recharge de 5 000 XAF n’apparaît pas.', true);

    const first = page.locator('[data-testid="ticket-message"]').first();
    await expect(first).toContainText('Ma recharge de 5 000 XAF');
    await expect(first).toHaveAttribute('data-from-admin', 'false');
    const image = first.locator('[data-testid="ticket-attachment"]');
    await expect(image).toHaveCount(1);
    // L'image vient d'une URL signée du bucket privé.
    const src = (await image.getAttribute('src')) ?? (await image.getAttribute('href')) ?? '';
    expect(src).toContain('ticket-attachments');
    await noHorizontalOverflow(page);
    await tapTargetsAreBigEnough(page);

    const { data } = await admin()
      .from('tickets')
      .select('status,subject,user_id')
      .eq('id', id)
      .single();
    expect(data).toMatchObject({ status: 'open', subject: 'recharge', user_id: user.id });

    await page.locator('[data-testid="ticket-close"]').click();
    await expect(page.locator('[data-testid="ticket-closed-notice"]')).toBeVisible();
    const after = await admin().from('tickets').select('status').eq('id', id).single();
    expect(after.data?.status).toBe('closed');
  });

  test('le ticket apparaît dans la liste, avec la réponse du propriétaire, et un message le rouvre', async ({
    page,
  }) => {
    await signedUp(page);
    const id = await openTicket(page, 'other', 'Question sur mon compte');

    await admin()
      .from('ticket_messages')
      .insert({ ticket_id: id, from_admin: true, body: 'Bonjour, c’est réglé.' });
    await page.reload();
    const rows = page.locator('[data-testid="ticket-message"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toHaveAttribute('data-from-admin', 'true');
    await expect(rows.nth(1)).toContainText('c’est réglé');

    await page.locator('[data-testid="ticket-close"]').click();
    await expect(page.locator('[data-testid="ticket-closed-notice"]')).toBeVisible();

    await page
      .locator('[data-testid="ticket-reply-body"]')
      .fill('Finalement, encore une question.');
    await page.locator('[data-testid="ticket-reply-send"]').click();
    await expect(page.locator('[data-testid="ticket-message"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="ticket-closed-notice"]')).toHaveCount(0);

    await page.goto('/fr/support');
    await expect(page.locator('[data-testid="ticket-row"]')).toHaveCount(1);
    await noHorizontalOverflow(page);
  });

  test('sujet « Commande » : il faut choisir une de ses commandes', async ({ page }) => {
    const user = await signedUp(page);
    const service = await makeService({ min_qty: 10, max_qty: 10_000 });
    const order = await makeOrder(user.id, service.id, { quantity: 500 });
    await page.goto('/fr/support');
    await page.locator('[data-testid="ticket-subject"]').selectOption('order');
    await page.locator('[data-testid="ticket-body"]').fill('Ma commande n’avance pas.');
    await page.locator('[data-testid="ticket-submit"]').click();
    // Sans commande choisie : on reste sur la page, rien n'est créé.
    await expect(page).toHaveURL(/\/fr\/support$/);
    await page.locator('[data-testid="ticket-order"]').selectOption(order.id);
    await page.locator('[data-testid="ticket-submit"]').click();
    await expect(page).toHaveURL(/\/fr\/support\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const { data } = await admin()
      .from('tickets')
      .select('order_id')
      .eq('user_id', user.id)
      .single();
    expect(data?.order_id).toBe(order.id);
  });

  test('un client ne peut pas ouvrir le ticket d’un autre (page introuvable)', async ({
    page,
    browser,
  }) => {
    await signedUp(page);
    const id = await openTicket(page, 'other', 'Mon ticket privé');
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const other = await context.newPage();
    await signedUp(other);
    const res = await other.goto(`/fr/support/${id}`);
    expect(res?.status()).toBe(404);
    await expect(other.locator('body')).not.toContainText('Mon ticket privé');
    await context.close();
  });
});
