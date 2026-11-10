import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import {
  paymentOf,
  setRechargeSettings,
  setupFakeSaspayEnv,
  walletOf,
} from '../helpers/payments-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { createPayment } from '@/server/payments/create-payment';
import { quotePayment } from '@/server/payments/quote';
import { getFakeSaspay } from '@/server/providers/saspay-client';

// Modules attendus (LLD §4.4) :
//   createPayment(userId, amountXaf, idempotencyKey): Promise<{ id, checkoutUrl }>
//     1) quote (réglages)  2) ligne payments  3) session SasPay (ADD_ON, expiration +30 min, metadata)  4) statut `pending`
//   quotePayment(amountXaf): Promise<{ amountXaf, feeXaf, totalToPay }> lit min/max/frais dans `settings`.
// Faux SasPay (SASPAY_MODE=test, sans clé) ; vraie base locale.

setupFakeSaspayEnv();
const db = adminClient();
const created: string[] = [];

async function user() {
  const u = await makeUser();
  created.push(u.id);
  return u;
}

beforeAll(async () => {
  await setRechargeSettings();
});
beforeEach(async () => {
  await setRechargeSettings();
});
afterEach(async () => {
  vi.restoreAllMocks();
  while (created.length) await removeUser(created.pop()!);
});

async function rowsForKey(key: string) {
  const { data } = await db.from('payments').select('*').eq('idem_key', key);
  return data ?? [];
}

describe('createPayment', () => {
  it('crée une recharge de 3 000 XAF : frais 90, à payer 3 090, statut pending, solde inchangé', async () => {
    const u = await user();
    const key = randomUUID();
    const { id, checkoutUrl } = await createPayment(u.id, 3000, key);

    expect(checkoutUrl).toMatch(/^https?:\/\//);
    const p = await paymentOf(id);
    expect(p).toMatchObject({
      user_id: u.id,
      credited_xaf: 3000,
      fee_xaf: 90,
      total_paid: 3090,
      pay_currency: 'XAF',
      status: 'pending',
      idem_key: key,
    });
    expect(p.saspay_session_id).toBeTruthy();
    expect((await walletOf(u.id)).balance_xaf).toBe(0);
  });

  it('demande à SasPay le montant crédité, les frais en plus (ADD_ON), l identifiant du paiement et 30 min', async () => {
    const u = await user();
    const before = Date.now();
    const { id } = await createPayment(u.id, 3000, randomUUID());
    const p = await paymentOf(id);

    const session = getFakeSaspay().sessions.get(p.saspay_session_id as string)!;
    expect(session.params.amount).toBe('3000.00');
    expect(session.params.currency).toBe('XAF');
    expect(session.params.feeChargeMode).toBe('ADD_ON');
    expect(session.params.customerEmail).toBe(u.email);
    expect(session.params.metadata).toEqual({ lyonpanel_payment_id: id });
    expect(session.params.returnUrl).toContain(`/recharger/${id}`);
    const expiresMs = new Date(session.params.expiresAt).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 30 * 60_000 - 5_000);
    expect(expiresMs).toBeLessThanOrEqual(Date.now() + 30 * 60_000 + 5_000);
  });

  it('même clé d idempotence deux fois : un seul paiement, la même réponse', async () => {
    const u = await user();
    const key = randomUUID();
    const a = await createPayment(u.id, 3000, key);
    const b = await createPayment(u.id, 3000, key);

    expect(b.id).toBe(a.id);
    expect(await rowsForKey(key)).toHaveLength(1);
  });

  it('5 appels en parallèle avec la même clé : un seul paiement, un seul id', async () => {
    const u = await user();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createPayment(u.id, 3000, key)),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await rowsForKey(key)).toHaveLength(1);
  });

  it('même clé avec un autre montant : IDEMPOTENCY_CONFLICT, aucun second paiement', async () => {
    const u = await user();
    const key = randomUUID();
    await createPayment(u.id, 3000, key);
    await expect(createPayment(u.id, 5000, key)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409,
    });
    expect(await rowsForKey(key)).toHaveLength(1);
  });

  it('deux clés différentes : deux paiements distincts', async () => {
    const u = await user();
    const a = await createPayment(u.id, 3000, randomUUID());
    const b = await createPayment(u.id, 3000, randomUUID());
    expect(b.id).not.toBe(a.id);
  });

  it('499 XAF : AMOUNT_BELOW_MINIMUM, aucune ligne, aucune session SasPay', async () => {
    const u = await user();
    const spy = vi.spyOn(getFakeSaspay(), 'createCheckoutSession');
    const key = randomUUID();
    await expect(createPayment(u.id, 499, key)).rejects.toMatchObject({
      code: 'AMOUNT_BELOW_MINIMUM',
      status: 422,
      details: { min_xaf: 500 },
    });
    expect(await rowsForKey(key)).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('500 XAF (minimum exact) et 500 000 XAF (maximum exact) sont acceptés', async () => {
    const u = await user();
    const low = await createPayment(u.id, 500, randomUUID());
    const high = await createPayment(u.id, 500_000, randomUUID());
    expect(await paymentOf(low.id)).toMatchObject({
      credited_xaf: 500,
      fee_xaf: 15,
      total_paid: 515,
    });
    expect(await paymentOf(high.id)).toMatchObject({
      credited_xaf: 500_000,
      fee_xaf: 15_000,
      total_paid: 515_000,
    });
  });

  it('500 001 XAF : refusé, aucune ligne', async () => {
    const u = await user();
    const key = randomUUID();
    await expect(createPayment(u.id, 500_001, key)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
      status: 422,
    });
    expect(await rowsForKey(key)).toHaveLength(0);
  });

  it('lit le minimum dans les réglages (pas en dur) : minimum à 800 -> 799 refusé', async () => {
    await setRechargeSettings({ min_recharge_xaf: 800 });
    const u = await user();
    await expect(createPayment(u.id, 799, randomUUID())).rejects.toMatchObject({
      code: 'AMOUNT_BELOW_MINIMUM',
      details: { min_xaf: 800 },
    });
    await expect(createPayment(u.id, 800, randomUUID())).resolves.toHaveProperty('id');
  });

  it('SasPay en panne : PROVIDER_ERROR, jamais de nouvel essai automatique, aucun crédit', async () => {
    const u = await user();
    const spy = vi
      .spyOn(getFakeSaspay(), 'createCheckoutSession')
      .mockRejectedValue(
        Object.assign(new Error('PROVIDER_ERROR'), { code: 'PROVIDER_ERROR', status: 502 }),
      );
    const key = randomUUID();
    await expect(createPayment(u.id, 3000, key)).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect((await walletOf(u.id)).balance_xaf).toBe(0);
    for (const row of await rowsForKey(key)) expect(row.status).not.toBe('succeeded');
  });
});

describe('quotePayment', () => {
  it('3 000 XAF avec les réglages (3 %) : frais 90, total 3 090', async () => {
    expect(await quotePayment(3000)).toEqual({ amountXaf: 3000, feeXaf: 90, totalToPay: 3090 });
  });

  it('lit le pourcentage de frais dans les réglages (5 % -> 150)', async () => {
    await setRechargeSettings({ saspay_fee_pct: 5 });
    expect(await quotePayment(3000)).toEqual({ amountXaf: 3000, feeXaf: 150, totalToPay: 3150 });
  });

  it('lit le maximum dans les réglages : maximum à 10 000 -> 10 001 refusé', async () => {
    await setRechargeSettings({ max_recharge_xaf: 10_000 });
    await expect(quotePayment(10_001)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(quotePayment(10_000)).resolves.toMatchObject({ amountXaf: 10_000 });
  });
});
