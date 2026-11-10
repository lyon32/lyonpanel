import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import {
  ageInMinutes,
  clearOtherPendingPayments,
  CRON_TEST_SECRET,
  journalOf,
  paymentOf,
  setRechargeSettings,
  setupFakeSaspayEnv,
  walletOf,
} from '../helpers/payments-db';
import { buildWebhook } from '../helpers/saspay-webhook';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { GET as cronRoute } from '@/app/api/cron/payments/route';
import { createPayment } from '@/server/payments/create-payment';
import { handleSaspayWebhook } from '@/server/payments/handle-webhook';
import { reconcilePendingPayments } from '@/server/payments/reconcile';
import { notifyOwner } from '@/server/providers/telegram';
import { getFakeSaspay } from '@/server/providers/saspay-client';

// Modules attendus :
//   reconcilePendingPayments(olderThanMinutes = 5): Promise<{ credited, failed }>
//     - revérifie chaque paiement `pending` créé il y a plus de N minutes :
//       session SUCCESS + verifyPayment SUCCESS -> credit_payment (une seule fois) ;
//       session FAILED/CANCELLED -> `failed` ; toujours PENDING après 30 min -> `failed` (expiré).
//     - une panne SasPay sur un paiement n'empêche pas de traiter les autres.
//   GET /api/cron/payments (src/app/api/cron/payments/route.ts) : Authorization: Bearer <CRON_SECRET>

setupFakeSaspayEnv();
const created: string[] = [];

async function newUser() {
  const u = await makeUser();
  created.push(u.id);
  return u;
}

beforeEach(async () => {
  await setRechargeSettings();
  await clearOtherPendingPayments();
  vi.mocked(notifyOwner).mockClear();
});
afterEach(async () => {
  vi.restoreAllMocks();
  while (created.length) await removeUser(created.pop()!);
});

/** Recharge de 3 000 XAF créée par le vrai code, vieillie de `age` minutes. */
async function pendingPayment(age: number, amount = 3000) {
  const u = await newUser();
  const { id } = await createPayment(u.id, amount, randomUUID());
  await ageInMinutes(id, age);
  const sessionId = (await paymentOf(id)).saspay_session_id as string;
  return { user: u, id, sessionId };
}

describe('reconcilePendingPayments : crédit manqué', () => {
  it('crédite une recharge payée dont le webhook n est jamais arrivé (10 min)', async () => {
    const p = await pendingPayment(10);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');

    const res = await reconcilePendingPayments(5);

    expect(res.credited).toBeGreaterThanOrEqual(1);
    expect((await paymentOf(p.id)).status).toBe('succeeded');
    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
    expect(await journalOf(p.id)).toHaveLength(1);
  });

  it('relancé deux fois : crédité une seule fois', async () => {
    const p = await pendingPayment(10);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');

    const first = await reconcilePendingPayments(5);
    const second = await reconcilePendingPayments(5);

    expect(first.credited).toBe(1);
    expect(second.credited).toBe(0);
    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
  });

  it('webhook déjà traité puis rattrapage : pas de second crédit', async () => {
    const p = await pendingPayment(10);
    const { data } = getFakeSaspay().settle(p.sessionId, 'SUCCESS');
    const w = buildWebhook({
      event: 'transaction.success',
      data: { ...data, metadata: { lyonpanel_payment_id: p.id } },
    });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');

    const res = await reconcilePendingPayments(5);

    expect(res.credited).toBe(0);
    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
  });

  it('webhook et rattrapage en même temps : 3 000 XAF crédités une seule fois', async () => {
    const p = await pendingPayment(10);
    const { data } = getFakeSaspay().settle(p.sessionId, 'SUCCESS');
    const w = buildWebhook({
      event: 'transaction.success',
      data: { ...data, metadata: { lyonpanel_payment_id: p.id } },
    });

    await Promise.all([
      handleSaspayWebhook(w.rawBody, w.headers),
      reconcilePendingPayments(5),
      handleSaspayWebhook(w.rawBody, w.headers),
      reconcilePendingPayments(5),
    ]);

    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
    expect(await journalOf(p.id)).toHaveLength(1);
  });

  it('ne touche pas une recharge plus récente que le délai (2 min < 5 min)', async () => {
    const p = await pendingPayment(2);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');

    await reconcilePendingPayments(5);

    expect((await paymentOf(p.id)).status).toBe('pending');
    expect((await walletOf(p.user.id)).balance_xaf).toBe(0);
  });

  it('respecte le délai demandé : avec 1 minute, la recharge de 2 min est traitée', async () => {
    const p = await pendingPayment(2);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');

    await reconcilePendingPayments(1);

    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
  });

  it('délai par défaut de 5 minutes : traite une recharge de 6 min, pas une de 4 min', async () => {
    const old = await pendingPayment(6);
    const fresh = await pendingPayment(4);
    getFakeSaspay().settle(old.sessionId, 'SUCCESS');
    getFakeSaspay().settle(fresh.sessionId, 'SUCCESS');

    await reconcilePendingPayments();

    expect((await walletOf(old.user.id)).balance_xaf).toBe(3000);
    expect((await walletOf(fresh.user.id)).balance_xaf).toBe(0);
  });

  it('ne crédite pas si verifyPayment ne confirme pas SUCCESS', async () => {
    const p = await pendingPayment(10);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');
    vi.spyOn(getFakeSaspay(), 'verifyPayment').mockResolvedValue({
      status: 'PENDING',
      netAmount: '3000.00',
      fee: '90.00',
      charged: '3090.00',
      currency: 'XAF',
    });

    await reconcilePendingPayments(5);

    expect((await walletOf(p.user.id)).balance_xaf).toBe(0);
  });

  it('montant net différent : alerte payment_mismatch, aucun crédit', async () => {
    const p = await pendingPayment(10);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS', { netAmount: '2500.00' });

    await reconcilePendingPayments(5);

    expect((await walletOf(p.user.id)).balance_xaf).toBe(0);
    expect((await paymentOf(p.id)).status).not.toBe('succeeded');
    expect(notifyOwner).toHaveBeenCalledWith(
      'payment_mismatch',
      expect.objectContaining({ payment_id: p.id }),
    );
  });
});

describe('reconcilePendingPayments : échecs et expiration', () => {
  it.each(['FAILED', 'CANCELLED'] as const)(
    'session %s : paiement failed, aucun crédit',
    async (outcome) => {
      const p = await pendingPayment(10);
      getFakeSaspay().settle(p.sessionId, outcome);

      const res = await reconcilePendingPayments(5);

      expect(res.failed).toBeGreaterThanOrEqual(1);
      expect((await paymentOf(p.id)).status).toBe('failed');
      expect((await walletOf(p.user.id)).balance_xaf).toBe(0);
    },
  );

  it('toujours en attente après 31 min : expirée (failed), aucun crédit', async () => {
    const p = await pendingPayment(31);

    const res = await reconcilePendingPayments(5);

    expect(res.failed).toBeGreaterThanOrEqual(1);
    expect((await paymentOf(p.id)).status).toBe('failed');
    expect((await walletOf(p.user.id)).balance_xaf).toBe(0);
  });

  it('toujours en attente après 20 min : reste pending (pas encore expirée)', async () => {
    const p = await pendingPayment(20);
    await reconcilePendingPayments(5);
    expect((await paymentOf(p.id)).status).toBe('pending');
  });

  it('payée juste avant l expiration mais vue après 31 min : créditée, pas expirée', async () => {
    const p = await pendingPayment(31);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');

    await reconcilePendingPayments(5);

    expect((await paymentOf(p.id)).status).toBe('succeeded');
    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
  });

  it('une panne SasPay sur un paiement n empêche pas de traiter les autres', async () => {
    const broken = await pendingPayment(10);
    const healthy = await pendingPayment(10);
    getFakeSaspay().settle(healthy.sessionId, 'SUCCESS');
    const fake = getFakeSaspay();
    const original = fake.getCheckoutSessionStatus.bind(fake);
    vi.spyOn(fake, 'getCheckoutSessionStatus').mockImplementation(async (id: string) => {
      if (id === broken.sessionId) {
        throw Object.assign(new Error('PROVIDER_TIMEOUT'), {
          code: 'PROVIDER_TIMEOUT',
          status: 504,
        });
      }
      return original(id);
    });

    await expect(reconcilePendingPayments(5)).resolves.toBeDefined();

    expect((await walletOf(healthy.user.id)).balance_xaf).toBe(3000);
    expect((await walletOf(broken.user.id)).balance_xaf).toBe(0);
    expect((await paymentOf(broken.id)).status).toBe('pending');
  });
});

describe('GET /api/cron/payments', () => {
  const call = (auth?: string) =>
    cronRoute(
      new NextRequest('http://localhost:3000/api/cron/payments', {
        headers: auth ? { authorization: auth } : {},
      }),
    );

  it('sans en-tête Authorization : refusé (401 ou 403), rien n est crédité', async () => {
    const p = await pendingPayment(10);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');
    const res = await call();
    expect([401, 403]).toContain(res.status);
    expect((await walletOf(p.user.id)).balance_xaf).toBe(0);
  });

  it('mauvais secret : refusé (401 ou 403)', async () => {
    const res = await call('Bearer pas-le-bon-secret');
    expect([401, 403]).toContain(res.status);
  });

  it('secret non configuré : refuse même un en-tête « Bearer undefined » ou vide', async () => {
    process.env.CRON_SECRET = '';
    try {
      for (const header of ['Bearer undefined', 'Bearer ', 'Bearer']) {
        expect([401, 403]).toContain((await call(header)).status);
      }
    } finally {
      process.env.CRON_SECRET = CRON_TEST_SECRET;
    }
  });

  it('bon secret : 200, rattrape les paiements et renvoie les compteurs', async () => {
    const p = await pendingPayment(10);
    getFakeSaspay().settle(p.sessionId, 'SUCCESS');

    const res = await call(`Bearer ${CRON_TEST_SECRET}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { credited: number; failed: number };
    expect(body.credited).toBeGreaterThanOrEqual(1);
    expect(typeof body.failed).toBe('number');
    expect((await walletOf(p.user.id)).balance_xaf).toBe(3000);
  });
});
