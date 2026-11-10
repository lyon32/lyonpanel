import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { env } = vi.hoisted(() => ({ env: { current: {} as Record<string, unknown> } }));
vi.mock('@/server/env', () => ({ loadServerEnv: () => env.current }));

import { createFakeSaspay, getFakeSaspay, getSaspay } from '@/server/providers/saspay-client';

// Module attendu : src/server/providers/saspay-client.ts (faux SasPay, mode test sans clé)
//   createFakeSaspay({ webhookSecret? }) -> SaspayApi + {
//     sessions: Map<sessionId, { params, status, transactionId | null, expiresAt }>,
//     settle(sessionId, outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED', opts?: { netAmount?: string }):
//        { transactionId: string; data: <charge utile `data` d'un webhook SasPay> } }
//   getSaspay(): faux SasPay si SASPAY_MODE=test et pas de clé ; client réel si une clé est fournie ;
//                refuse de démarrer en mode live sans clé.
//   getFakeSaspay(): le même faux SasPay que getSaspay() renvoie en mode test (partagé par le processus).
// Le faux SasPay est déterministe, n'appelle jamais le réseau, et frais = 3 % (comme le réglage par défaut).

const params = (paymentId: string, amount = '3000.00') => ({
  amount,
  currency: 'XAF' as const,
  customerEmail: 'client-1@lyonpanel.test',
  customerName: 'Awa',
  returnUrl: `https://lyonpanel.com/fr/recharger/${paymentId}`,
  metadata: { lyonpanel_payment_id: paymentId },
  feeChargeMode: 'ADD_ON' as const,
  expiresAt: '2026-11-10T12:30:00.000Z',
});

beforeEach(() => {
  env.current = { SASPAY_MODE: 'test', SASPAY_WEBHOOK_SECRET: 'whsec_test' };
  vi.restoreAllMocks();
});

describe('faux SasPay', () => {
  it('crée une session avec une adresse de paiement et un identifiant, sans réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fake = createFakeSaspay();
    const res = await fake.createCheckoutSession(params('pay-1'));
    expect(res.sessionId).toMatch(/\S+/);
    expect(res.checkoutUrl).toMatch(/^https?:\/\//);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('est déterministe : le même paiement donne la même session', async () => {
    const a = await createFakeSaspay().createCheckoutSession(params('pay-1'));
    const b = await createFakeSaspay().createCheckoutSession(params('pay-1'));
    expect(a).toEqual(b);
  });

  it('deux paiements différents donnent deux sessions différentes', async () => {
    const fake = createFakeSaspay();
    const a = await fake.createCheckoutSession(params('pay-1'));
    const b = await fake.createCheckoutSession(params('pay-2'));
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it('garde les paramètres reçus, dont l expiration et le mode de frais ADD_ON', async () => {
    const fake = createFakeSaspay();
    const { sessionId } = await fake.createCheckoutSession(params('pay-1'));
    const s = fake.sessions.get(sessionId)!;
    expect(s.expiresAt).toBe('2026-11-10T12:30:00.000Z');
    expect(s.params.feeChargeMode).toBe('ADD_ON');
    expect(s.status).toBe('PENDING');
  });

  it('la session reste PENDING sans transaction tant que le client n a pas payé', async () => {
    const fake = createFakeSaspay();
    const { sessionId } = await fake.createCheckoutSession(params('pay-1'));
    expect(await fake.getCheckoutSessionStatus(sessionId)).toEqual({
      status: 'PENDING',
      transactionId: null,
    });
  });

  it('settle SUCCESS : 3 000 XAF -> net 3000.00, frais 90.00, payé 3090.00', async () => {
    const fake = createFakeSaspay();
    const { sessionId } = await fake.createCheckoutSession(params('pay-1'));
    const { transactionId, data } = fake.settle(sessionId, 'SUCCESS');

    expect(await fake.getCheckoutSessionStatus(sessionId)).toEqual({
      status: 'SUCCESS',
      transactionId,
    });
    expect(await fake.verifyPayment(transactionId)).toEqual({
      status: 'SUCCESS',
      netAmount: '3000.00',
      fee: '90.00',
      charged: '3090.00',
      currency: 'XAF',
    });
    expect(data).toMatchObject({
      id: transactionId,
      status: 'SUCCESS',
      net_amount: '3000.00',
      fee: '90.00',
      charged: '3090.00',
      fee_charge_mode: 'ADD_ON',
      currency: 'XAF',
    });
  });

  it('settle FAILED et CANCELLED sont visibles dans le statut', async () => {
    const fake = createFakeSaspay();
    const a = await fake.createCheckoutSession(params('pay-1'));
    const b = await fake.createCheckoutSession(params('pay-2'));
    fake.settle(a.sessionId, 'FAILED');
    fake.settle(b.sessionId, 'CANCELLED');
    expect((await fake.getCheckoutSessionStatus(a.sessionId)).status).toBe('FAILED');
    expect((await fake.getCheckoutSessionStatus(b.sessionId)).status).toBe('CANCELLED');
  });

  it('settle peut simuler un montant net différent du montant demandé', async () => {
    const fake = createFakeSaspay();
    const { sessionId } = await fake.createCheckoutSession(params('pay-1'));
    const { transactionId } = fake.settle(sessionId, 'SUCCESS', { netAmount: '2500.00' });
    expect((await fake.verifyPayment(transactionId)).netAmount).toBe('2500.00');
  });

  it('verifyPayment connaît les transactions réglées par settle et refuse les autres (PROVIDER_ERROR)', async () => {
    const fake = createFakeSaspay();
    const { sessionId } = await fake.createCheckoutSession(params('pay-1'));
    await expect(fake.verifyPayment('txn_pas_encore_reglee')).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
    const { transactionId } = fake.settle(sessionId, 'FAILED');
    expect((await fake.verifyPayment(transactionId)).status).toBe('FAILED');
  });

  it('une session inconnue donne une erreur PROVIDER_ERROR', async () => {
    await expect(createFakeSaspay().getCheckoutSessionStatus('cs_inconnue')).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });
});

describe('getSaspay (choix du faux ou du vrai)', () => {
  it('en mode test sans clé : faux SasPay, aucun appel réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await getSaspay().createCheckoutSession(params('pay-9'));
    expect(res.checkoutUrl).toMatch(/^https?:\/\//);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('en mode test : getSaspay() et getFakeSaspay() partagent les mêmes sessions', async () => {
    const { sessionId } = await getSaspay().createCheckoutSession(params('pay-shared'));
    expect(getFakeSaspay().sessions.has(sessionId)).toBe(true);
  });

  it('en mode live sans clé : refuse de démarrer', () => {
    env.current = { SASPAY_MODE: 'live', SASPAY_API_URL: 'https://x.invalid/api/v1' };
    expect(() => getSaspay()).toThrow();
  });

  it('avec une clé de test : renvoie un client réel qui expose les 5 méthodes', () => {
    env.current = {
      SASPAY_MODE: 'test',
      SASPAY_API_URL: 'https://x.invalid/api/v1',
      SASPAY_API_KEY: 'sk_test_x',
      SASPAY_WEBHOOK_SECRET: 'whsec_test',
    };
    const s = getSaspay();
    for (const m of [
      'createCheckoutSession',
      'getCheckoutSessionStatus',
      'verifyPayment',
      'getMyRates',
      'verifyWebhook',
    ] as const) {
      expect(typeof s[m]).toBe('function');
    }
  });
});
