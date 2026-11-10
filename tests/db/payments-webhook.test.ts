import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import {
  journalOf,
  paymentOf,
  restoreRechargeStateAfterAll,
  setRechargeSettings,
  setupFakeSaspayEnv,
  walletOf,
} from '../helpers/payments-db';
import {
  buildWebhook,
  webhookData,
  webhookRequest,
  type WebhookData,
} from '../helpers/saspay-webhook';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { POST as webhookRoute } from '@/app/api/webhooks/saspay/route';
import { createPayment } from '@/server/payments/create-payment';
import { handleSaspayWebhook } from '@/server/payments/handle-webhook';
import { notifyOwner } from '@/server/providers/telegram';
import { getFakeSaspay } from '@/server/providers/saspay-client';

// Modules attendus :
//   handleSaspayWebhook(rawBody, headers): 'credited' | 'duplicate' | 'failed' | 'rejected'
//     - 'rejected' = signature ou horodatage invalide (la route répond 403) ; les autres cas répondent 200
//     - DÉCISION 2026-11-10 (SECURITY_NOTES §3) : après la signature, appelle saspay.verifyPayment(data.id),
//       exige status SUCCESS et utilise le netAmount RENVOYÉ PAR verifyPayment (jamais celui du corps du webhook)
//     - verifyPayment en panne : l'erreur remonte (la route répond 502), aucun crédit, SasPay renverra le webhook
//     - crédit uniquement par la fonction SQL credit_payment, du net vérifié (jamais `amount` ni `charged`)
//     - paiement retrouvé par data.metadata.lyonpanel_payment_id, sinon par saspay_transaction_id via le statut de session
//     - net_amount ≠ montant demandé : alerte notifyOwner('payment_mismatch'), aucun crédit
//   POST /api/webhooks/saspay (src/app/api/webhooks/saspay/route.ts)

setupFakeSaspayEnv();
restoreRechargeStateAfterAll();
const created: string[] = [];

async function newUser() {
  const u = await makeUser();
  created.push(u.id);
  return u;
}

beforeEach(async () => {
  await setRechargeSettings();
  vi.mocked(notifyOwner).mockClear();
});
afterEach(async () => {
  vi.restoreAllMocks();
  while (created.length) await removeUser(created.pop()!);
});

/** Une recharge de `amount` XAF réellement créée, puis réglée côté (faux) SasPay. */
async function paidPayment(
  amount = 3000,
  outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' = 'SUCCESS',
  opts: { netAmount?: string } = {},
) {
  const u = await newUser();
  const { id } = await createPayment(u.id, amount, randomUUID());
  const p = await paymentOf(id);
  const sessionId = p.saspay_session_id as string;
  const { transactionId, data } = getFakeSaspay().settle(sessionId, outcome, opts);
  const eventByOutcome = {
    SUCCESS: 'transaction.success',
    FAILED: 'transaction.failed',
    CANCELLED: 'transaction.cancelled',
  } as const;
  const withMeta: WebhookData = { ...data, metadata: { lyonpanel_payment_id: id } };
  return { user: u, id, sessionId, transactionId, data, withMeta, event: eventByOutcome[outcome] };
}

describe('handleSaspayWebhook : crédit', () => {
  it('3 000 XAF payés : crédite le net_amount, une seule ligne de journal, paiement succeeded', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });

    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');

    // 3 000 (net_amount), pas 3 090 (charged) : les frais sont payés en plus par le client.
    expect(await walletOf(pay.user.id)).toMatchObject({
      balance_xaf: 3000,
      total_recharged_xaf: 3000,
    });
    const p = await paymentOf(pay.id);
    expect(p).toMatchObject({
      status: 'succeeded',
      saspay_transaction_id: pay.transactionId,
      fee_xaf: 90,
      total_paid: 3090,
    });
    expect(p.succeeded_at).toBeTruthy();
    const journal = await journalOf(pay.id);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ ref: `pay:${pay.id}`, amount_xaf: 3000 });
  });

  it('ne garde pas le numéro de téléphone du payeur dans raw_webhook', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({
      event: pay.event,
      data: { ...pay.withMeta, msisdn: '+237699000123' },
    });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');
    const p = await paymentOf(pay.id);
    expect(p.raw_webhook).toBeTruthy();
    expect(JSON.stringify(p.raw_webhook)).not.toContain('699000123');
  });

  it('le même webhook renvoyé 5 fois : crédité une seule fois', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });

    const results: string[] = [];
    for (let i = 0; i < 5; i++) results.push(await handleSaspayWebhook(w.rawBody, w.headers));

    expect(results).toEqual(['credited', 'duplicate', 'duplicate', 'duplicate', 'duplicate']);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
    expect(await journalOf(pay.id)).toHaveLength(1);
  });

  it('un renvoi de SasPay (nouvel horodatage, nouvelle signature) : doublon, pas de second crédit', async () => {
    const pay = await paidPayment();
    const first = buildWebhook({
      event: pay.event,
      data: pay.withMeta,
      timestamp: Math.floor(Date.now() / 1000) - 60,
    });
    const retry = buildWebhook({ event: pay.event, data: pay.withMeta });
    expect(first.signature).not.toBe(retry.signature);

    expect(await handleSaspayWebhook(first.rawBody, first.headers)).toBe('credited');
    expect(await handleSaspayWebhook(retry.rawBody, retry.headers)).toBe('duplicate');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
  });

  it('10 webhooks identiques en parallèle : exactement un crédit, 3 000 XAF au total', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => handleSaspayWebhook(w.rawBody, w.headers)),
    );

    expect(results.filter((r) => r === 'credited')).toHaveLength(1);
    expect(results.filter((r) => r === 'duplicate')).toHaveLength(9);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
    expect(await journalOf(pay.id)).toHaveLength(1);
  });

  it('retrouve le paiement par la transaction quand metadata est absente', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.data });

    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
    expect((await paymentOf(pay.id)).saspay_transaction_id).toBe(pay.transactionId);
  });

  it('transaction introuvable et metadata absente : aucun crédit, aucune exception', async () => {
    const pay = await paidPayment();
    const stranger = { ...pay.data, id: `txn_inconnue_${randomUUID()}` };
    const w = buildWebhook({ event: pay.event, data: stranger });

    const result = await handleSaspayWebhook(w.rawBody, w.headers);
    expect(result).not.toBe('credited');
    expect(result).not.toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('metadata qui pointe vers un paiement inexistant : aucun crédit, aucune exception', async () => {
    const pay = await paidPayment();
    const data = { ...pay.data, metadata: { lyonpanel_payment_id: randomUUID() } };
    const w = buildWebhook({ event: pay.event, data });
    const result = await handleSaspayWebhook(w.rawBody, w.headers);
    expect(result).not.toBe('credited');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });
});

describe('handleSaspayWebhook : montant différent', () => {
  it.each(['2500.00', '3000.50', '3090.00'])(
    'net_amount %s au lieu de 3000.00 : alerte payment_mismatch, aucun crédit',
    async (netAmount) => {
      const pay = await paidPayment(3000, 'SUCCESS', { netAmount });
      const w = buildWebhook({
        event: pay.event,
        data: { ...pay.withMeta, net_amount: netAmount },
      });

      const result = await handleSaspayWebhook(w.rawBody, w.headers);

      expect(result).not.toBe('credited');
      expect(result).not.toBe('rejected');
      expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
      expect(await journalOf(pay.id)).toHaveLength(0);
      expect((await paymentOf(pay.id)).status).not.toBe('succeeded');
      expect(notifyOwner).toHaveBeenCalledWith(
        'payment_mismatch',
        expect.objectContaining({ payment_id: pay.id }),
      );
    },
  );
});

describe('handleSaspayWebhook : vérification auprès de SasPay (verifyPayment)', () => {
  it('appelle verifyPayment avec l identifiant de transaction du webhook', async () => {
    const pay = await paidPayment();
    const spy = vi.spyOn(getFakeSaspay(), 'verifyPayment');
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });
    await handleSaspayWebhook(w.rawBody, w.headers);
    expect(spy).toHaveBeenCalledWith(pay.transactionId);
  });

  it('webhook « success » mais SasPay dit FAILED : aucun crédit', async () => {
    const pay = await paidPayment(3000, 'FAILED');
    const w = buildWebhook({
      event: 'transaction.success',
      data: { ...pay.withMeta, status: 'SUCCESS' },
    });
    const result = await handleSaspayWebhook(w.rawBody, w.headers);
    expect(result).not.toBe('credited');
    expect(result).not.toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
    expect(await journalOf(pay.id)).toHaveLength(0);
  });

  it('webhook « success » mais SasPay dit PENDING : aucun crédit', async () => {
    const pay = await paidPayment();
    vi.spyOn(getFakeSaspay(), 'verifyPayment').mockResolvedValue({
      status: 'PENDING',
      netAmount: '3000.00',
      fee: '90.00',
      charged: '3090.00',
      currency: 'XAF',
    });
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).not.toBe('credited');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
    expect((await paymentOf(pay.id)).status).toBe('pending');
  });

  it('webhook signé qui annonce 9 000 alors que SasPay confirme 3 000 : crédit de 3 000 seulement', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({
      event: pay.event,
      data: { ...pay.withMeta, net_amount: '9000.00', amount: '9000.00' },
    });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
  });

  it('webhook annonce 3 000 mais SasPay confirme 2 500 : payment_mismatch, aucun crédit', async () => {
    const pay = await paidPayment(3000, 'SUCCESS', { netAmount: '2500.00' });
    const w = buildWebhook({ event: pay.event, data: { ...pay.withMeta, net_amount: '3000.00' } });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).not.toBe('credited');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
    expect(notifyOwner).toHaveBeenCalledWith(
      'payment_mismatch',
      expect.objectContaining({ payment_id: pay.id }),
    );
  });

  it('transaction jamais réglée côté SasPay : aucun crédit', async () => {
    const u = await newUser();
    const { id } = await createPayment(u.id, 3000, randomUUID());
    const w = buildWebhook({
      event: 'transaction.success',
      data: webhookData({ id: 'txn_jamais_regle', metadata: { lyonpanel_payment_id: id } }),
    });
    await handleSaspayWebhook(w.rawBody, w.headers).catch(() => 'error');
    expect((await walletOf(u.id)).balance_xaf).toBe(0);
    expect((await paymentOf(id)).status).toBe('pending');
  });

  it('panne de verifyPayment : l erreur remonte, aucun crédit ; le renvoi crédite une seule fois', async () => {
    const pay = await paidPayment();
    const spy = vi
      .spyOn(getFakeSaspay(), 'verifyPayment')
      .mockRejectedValueOnce(new Error('SasPay indisponible'));
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });

    await expect(handleSaspayWebhook(w.rawBody, w.headers)).rejects.toThrow();
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
    expect((await paymentOf(pay.id)).status).toBe('pending');

    spy.mockRestore();
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('duplicate');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
    expect(await journalOf(pay.id)).toHaveLength(1);
  });

  it('route : panne de verifyPayment -> 5xx sans crédit ; renvoi -> 200 et 3 000 XAF une seule fois', async () => {
    const pay = await paidPayment();
    const spy = vi
      .spyOn(getFakeSaspay(), 'verifyPayment')
      .mockRejectedValueOnce(new Error('SasPay indisponible'));
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });

    const down = await webhookRoute(webhookRequest(w));
    expect(down.status).toBeGreaterThanOrEqual(500);
    expect(down.status).toBeLessThan(600);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);

    spy.mockRestore();
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
    expect(await journalOf(pay.id)).toHaveLength(1);
  });

  it('signature fausse : verifyPayment n est même pas appelé', async () => {
    const pay = await paidPayment();
    const spy = vi.spyOn(getFakeSaspay(), 'verifyPayment');
    const w = buildWebhook({ event: pay.event, data: pay.withMeta, signature: 'd'.repeat(64) });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('rejected');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('handleSaspayWebhook : échecs et événements ignorés', () => {
  it.each(['FAILED', 'CANCELLED'] as const)(
    'transaction %s : statut failed, aucun crédit',
    async (outcome) => {
      const pay = await paidPayment(3000, outcome);
      const w = buildWebhook({ event: pay.event, data: pay.withMeta });

      expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('failed');

      expect((await paymentOf(pay.id)).status).toBe('failed');
      expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
      expect(await journalOf(pay.id)).toHaveLength(0);
    },
  );

  it.each(['webhook.test', 'transaction.refunded', 'quelque.chose'])(
    'événement %s signé mais inconnu : ignoré, rien ne change',
    async (event) => {
      const pay = await paidPayment();
      const w = buildWebhook({ event, data: pay.withMeta });

      const result = await handleSaspayWebhook(w.rawBody, w.headers);

      expect(result).not.toBe('credited');
      expect(result).not.toBe('rejected');
      expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
      expect((await paymentOf(pay.id)).status).toBe('pending');
    },
  );
});

describe('handleSaspayWebhook : signature et horodatage', () => {
  it('signature fausse : rejected, aucun crédit', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({
      event: pay.event,
      data: pay.withMeta,
      signature: 'a'.repeat(64),
    });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('signature faite avec un autre secret : rejected', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta, secret: 'pas-le-bon-secret' });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('corps modifié après signature (montant gonflé) : rejected', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });
    const tampered = w.rawBody.replace('"3000.00"', '"9000.00"');
    expect(tampered).not.toBe(w.rawBody);
    expect(await handleSaspayWebhook(tampered, w.headers)).toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('horodatage trop vieux (330 s) : rejected même avec une bonne signature', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({
      event: pay.event,
      data: pay.withMeta,
      timestamp: Math.floor(Date.now() / 1000) - 330,
    });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('horodatage dans le futur (330 s) : rejected', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({
      event: pay.event,
      data: pay.withMeta,
      timestamp: Math.floor(Date.now() / 1000) + 330,
    });
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('rejected');
  });

  it('en-têtes absents : rejected', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });
    expect(await handleSaspayWebhook(w.rawBody, new Headers())).toBe('rejected');
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });
});

describe('POST /api/webhooks/saspay', () => {
  it('signature valide : 200 rapide (moins de 5 s) et crédit', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });
    const started = Date.now();
    const res = await webhookRoute(webhookRequest(w));
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(5000);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
  });

  it('doublon déjà traité : 200 aussi, sans second crédit', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta });
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(3000);
  });

  it('signature fausse : 403, aucun crédit', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta, signature: 'b'.repeat(64) });
    const res = await webhookRoute(webhookRequest(w));
    expect(res.status).toBe(403);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('horodatage trop vieux ou futur (330 s) : 403', async () => {
    const pay = await paidPayment();
    const now = Math.floor(Date.now() / 1000);
    for (const timestamp of [now - 330, now + 330]) {
      const w = buildWebhook({ event: pay.event, data: pay.withMeta, timestamp });
      expect((await webhookRoute(webhookRequest(w))).status).toBe(403);
    }
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('horodatage à 290 s dans le passé : accepté (200)', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({
      event: pay.event,
      data: pay.withMeta,
      timestamp: Math.floor(Date.now() / 1000) - 290,
    });
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
  });

  it('événement inconnu signé : 200 (SasPay ne doit pas relancer)', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: 'webhook.test', data: pay.withMeta });
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
  });

  it('montant différent : 200 (le propriétaire est alerté), aucun crédit', async () => {
    const pay = await paidPayment(3000, 'SUCCESS', { netAmount: '2500.00' });
    const w = buildWebhook({ event: pay.event, data: { ...pay.withMeta, net_amount: '2500.00' } });
    expect((await webhookRoute(webhookRequest(w))).status).toBe(200);
    expect((await walletOf(pay.user.id)).balance_xaf).toBe(0);
  });

  it('la réponse 403 n affiche ni secret ni détail interne', async () => {
    const pay = await paidPayment();
    const w = buildWebhook({ event: pay.event, data: pay.withMeta, signature: 'c'.repeat(64) });
    const text = await (await webhookRoute(webhookRequest(w))).text();
    expect(text).not.toContain(process.env.SASPAY_WEBHOOK_SECRET ?? 'x');
    expect(text.toLowerCase()).not.toContain('credit_payment');
  });
});
