import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createSaspayClient } from '@/server/providers/saspay-client';

// Module attendu : src/server/providers/saspay-client.ts
//   createSaspayClient({ apiUrl, apiKey, webhookSecret, fetch?, timeoutMs? }) -> SaspayApi (LLD §4.5)
//   - en-tête Authorization: Bearer <clé> (jamais dans l'adresse), corps JSON en snake_case
//   - enveloppe SasPay { success, data | error, code } ; délai 10 000 ms par défaut
//   - toute erreur -> ApiError PROVIDER_ERROR (502) ou PROVIDER_TIMEOUT (504), sans clé ni message brut
// Aucun appel réseau réel : fetch est toujours simulé.

const KEY = 'sk_test_SECRETKEY-abc123-do-not-leak';
const BASE = 'https://saspay.example.invalid/api/v1';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, code: 'ok' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function client(f: FetchMock, extra: { timeoutMs?: number } = {}) {
  return createSaspayClient({
    apiUrl: BASE,
    apiKey: KEY,
    webhookSecret: 'whsec_x',
    fetch: f as unknown as typeof fetch,
    ...extra,
  });
}

const spies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
  }
});
afterEach(() => {
  spies.length = 0;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function allLogged(): string {
  return spies.map((s) => JSON.stringify(s.mock.calls)).join('\n');
}

const SESSION = {
  amount: '3000.00',
  currency: 'XAF' as const,
  customerEmail: 'client-1@lyonpanel.test',
  customerName: 'Awa',
  customerPhone: '+237600000001',
  country: 'CM',
  returnUrl: 'https://lyonpanel.com/fr/recharger/abc',
  metadata: { lyonpanel_payment_id: 'abc' },
  feeChargeMode: 'ADD_ON' as const,
  expiresAt: '2026-11-10T12:30:00.000Z',
};

describe('client SasPay : création de session', () => {
  it('envoie POST /checkout-sessions/ avec la clé en Bearer et les champs en snake_case', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      ok(
        {
          id: 'cs_1',
          checkout_url: 'https://pay.example.invalid/cs_1',
          status: 'PENDING',
          transaction: null,
        },
        201,
      ),
    );
    const res = await client(f).createCheckoutSession(SESSION);

    expect(res).toEqual({ sessionId: 'cs_1', checkoutUrl: 'https://pay.example.invalid/cs_1' });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/checkout-sessions/`);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`);
    expect(String(url)).not.toContain(KEY);
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: '3000.00',
      currency: 'XAF',
      customer_email: 'client-1@lyonpanel.test',
      customer_name: 'Awa',
      customer_phone: '+237600000001',
      country: 'CM',
      return_url: 'https://lyonpanel.com/fr/recharger/abc',
      metadata: { lyonpanel_payment_id: 'abc' },
      fee_charge_mode: 'ADD_ON',
      expires_at: '2026-11-10T12:30:00.000Z',
    });
  });

  it('passe un signal d annulation à fetch', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      ok({ id: 'cs_1', checkout_url: 'https://x.invalid/1' }),
    );
    await client(f).createCheckoutSession(SESSION);
    expect(f.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('client SasPay : lectures', () => {
  it('getCheckoutSessionStatus lit /checkout-sessions/{id}/status/ et renvoie transactionId', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      ok({ id: 'cs_1', status: 'SUCCESS', transaction: { id: 'txn_9' } }),
    );
    const res = await client(f).getCheckoutSessionStatus('cs_1');
    expect(res).toEqual({ status: 'SUCCESS', transactionId: 'txn_9' });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/checkout-sessions/cs_1/status/`);
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('getCheckoutSessionStatus renvoie transactionId null tant qu il n y a pas de transaction', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      ok({ id: 'cs_1', status: 'PENDING', transaction: null }),
    );
    expect(await client(f).getCheckoutSessionStatus('cs_1')).toEqual({
      status: 'PENDING',
      transactionId: null,
    });
  });

  it('verifyPayment lit /payments/{id}/verify/ et renvoie les montants en texte', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      ok({
        id: 'txn_9',
        status: 'SUCCESS',
        net_amount: '3000.00',
        fee: '90.00',
        charged: '3090.00',
        currency: 'XAF',
      }),
    );
    const res = await client(f).verifyPayment('txn_9');
    expect(res).toEqual({
      status: 'SUCCESS',
      netAmount: '3000.00',
      fee: '90.00',
      charged: '3090.00',
      currency: 'XAF',
    });
    expect(String(f.mock.calls[0]![0])).toBe(`${BASE}/payments/txn_9/verify/`);
  });

  it('refuse un statut inconnu (réponse invalide -> PROVIDER_ERROR)', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      ok({
        id: 'txn_9',
        status: 'WEIRD',
        net_amount: '1',
        fee: '0',
        charged: '1',
        currency: 'XAF',
      }),
    );
    await expect(client(f).verifyPayment('txn_9')).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      status: 502,
    });
  });
});

describe('client SasPay : erreurs et délai', () => {
  it('une erreur métier SasPay donne PROVIDER_ERROR sans le message brut ni la clé', async () => {
    const f = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { message: `RAW-SASPAY-MESSAGE ${KEY}` },
            code: 'insufficient_balance',
          }),
          { status: 400 },
        ),
    );
    const err = await client(f)
      .createCheckoutSession(SESSION)
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'PROVIDER_ERROR', status: 502 });
    const dump = JSON.stringify({
      m: (err as Error).message,
      d: (err as { details?: unknown }).details,
    });
    expect(dump).not.toContain('RAW-SASPAY-MESSAGE');
    expect(dump).not.toContain(KEY);
    expect(allLogged()).not.toContain(KEY);
  });

  it('une panne réseau donne PROVIDER_ERROR et la clé n apparaît dans aucun journal', async () => {
    const f = vi.fn<typeof fetch>(async () => {
      throw new Error(`connect ECONNREFUSED with Bearer ${KEY}`);
    });
    const err = await client(f)
      .verifyPayment('txn_1')
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'PROVIDER_ERROR' });
    expect(String((err as Error).message)).not.toContain(KEY);
    expect(allLogged()).not.toContain(KEY);
  });

  it('un HTTP 429 ou 500 donne PROVIDER_ERROR', async () => {
    for (const status of [429, 500]) {
      const f = vi.fn<typeof fetch>(async () => new Response('{}', { status }));
      await expect(client(f).getCheckoutSessionStatus('cs_1')).rejects.toMatchObject({
        code: 'PROVIDER_ERROR',
      });
    }
  });

  it('le délai par défaut est de 10 s : PROVIDER_TIMEOUT (504) à 10 000 ms, pas avant', async () => {
    vi.useFakeTimers();
    const f = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    let outcome: unknown = 'pending';
    const p = client(f)
      .verifyPayment('txn_1')
      .catch((e: unknown) => {
        outcome = e;
      });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(outcome).toMatchObject({ code: 'PROVIDER_TIMEOUT', status: 504 });
  });

  it('la création de session n est JAMAIS relancée automatiquement (risque de double paiement)', async () => {
    const f = vi.fn<typeof fetch>(async () => new Response('{}', { status: 500 }));
    await client(f)
      .createCheckoutSession(SESSION)
      .catch(() => {});
    expect(f).toHaveBeenCalledTimes(1);
  });
});
