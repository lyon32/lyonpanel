import { timingSafeEqual } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signWebhook, TEST_WEBHOOK_SECRET } from '../../helpers/saspay-webhook';

vi.mock('server-only', () => ({}));
vi.mock('node:crypto', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:crypto')>();
  return { ...real, timingSafeEqual: vi.fn(real.timingSafeEqual) };
});

import { createFakeSaspay, createSaspayClient } from '@/server/providers/saspay-client';

// Module attendu : src/server/providers/saspay-client.ts
//   verifyWebhook(rawBody, signature, timestamp): boolean
//   HMAC-SHA256 hex de `timestamp + "." + corps brut`, comparaison avec timingSafeEqual, horodatage à ± 300 s.
// Le vrai client et le faux SasPay doivent se comporter de la même façon.

const NOW_MS = Date.UTC(2026, 10, 10, 12, 0, 0);
const NOW_S = NOW_MS / 1000;
const BODY = '{"event":"transaction.success",  "data":{"id":"txn_1","net_amount":"3000.00"}}';

const makers = {
  'vrai client': () =>
    createSaspayClient({
      apiUrl: 'https://x.invalid/api/v1',
      apiKey: 'sk_test_x',
      webhookSecret: TEST_WEBHOOK_SECRET,
    }),
  'faux SasPay': () => createFakeSaspay({ webhookSecret: TEST_WEBHOOK_SECRET }),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
  vi.mocked(timingSafeEqual).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe.each(Object.entries(makers))('verifyWebhook (%s)', (_name, make) => {
  const sign = (body = BODY, ts: number | string = NOW_S) => signWebhook(body, ts);

  it('accepte une signature valide calculée sur le corps brut (espaces conservés)', () => {
    expect(make().verifyWebhook(BODY, sign(), String(NOW_S))).toBe(true);
  });

  it('refuse un corps reformaté (JSON identique mais octets différents)', () => {
    const reformatted = JSON.stringify(JSON.parse(BODY));
    expect(make().verifyWebhook(reformatted, sign(), String(NOW_S))).toBe(false);
  });

  it('refuse un corps modifié d un seul caractère', () => {
    expect(make().verifyWebhook(BODY.replace('3000', '9000'), sign(), String(NOW_S))).toBe(false);
  });

  it('refuse une signature faite avec un autre secret', () => {
    const forged = signWebhook(BODY, NOW_S, 'autre-secret');
    expect(make().verifyWebhook(BODY, forged, String(NOW_S))).toBe(false);
  });

  it('refuse une signature de mauvaise longueur sans lever d exception', () => {
    expect(make().verifyWebhook(BODY, 'abcd', String(NOW_S))).toBe(false);
    expect(make().verifyWebhook(BODY, '', String(NOW_S))).toBe(false);
  });

  it('refuse une signature qui n est pas de l hexadécimal', () => {
    expect(make().verifyWebhook(BODY, 'z'.repeat(64), String(NOW_S))).toBe(false);
  });

  it('refuse un horodatage non numérique ou vide', () => {
    expect(make().verifyWebhook(BODY, sign(BODY, 'abc'), 'abc')).toBe(false);
    expect(make().verifyWebhook(BODY, sign(BODY, ''), '')).toBe(false);
  });

  it('accepte un horodatage à exactement 300 s dans le passé et dans le futur', () => {
    expect(make().verifyWebhook(BODY, sign(BODY, NOW_S - 300), String(NOW_S - 300))).toBe(true);
    expect(make().verifyWebhook(BODY, sign(BODY, NOW_S + 300), String(NOW_S + 300))).toBe(true);
  });

  it('refuse un horodatage trop vieux (301 s) avec une signature pourtant correcte', () => {
    const ts = NOW_S - 301;
    expect(make().verifyWebhook(BODY, sign(BODY, ts), String(ts))).toBe(false);
  });

  it('refuse un horodatage dans le futur (301 s) avec une signature pourtant correcte', () => {
    const ts = NOW_S + 301;
    expect(make().verifyWebhook(BODY, sign(BODY, ts), String(ts))).toBe(false);
  });

  it('compare les signatures en temps constant (timingSafeEqual)', () => {
    make().verifyWebhook(BODY, sign(), String(NOW_S));
    expect(timingSafeEqual).toHaveBeenCalled();
  });
});
