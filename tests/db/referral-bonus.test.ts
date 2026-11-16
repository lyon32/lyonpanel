import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePayment } from '../factories/payment';
import { makeUser, removeUser } from '../factories/user';
import {
  journalOf,
  paymentOf,
  restoreRechargeStateAfterAll,
  setRechargeSettings,
  setupFakeSaspayEnv,
  walletOf,
} from '../helpers/payments-db';
import { buildWebhook, type WebhookData } from '../helpers/saspay-webhook';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { createPayment } from '@/server/payments/create-payment';
import { handleSaspayWebhook } from '@/server/payments/handle-webhook';
import { getFakeSaspay } from '@/server/providers/saspay-client';

/*
 * Règles de bonus de parrainage (phase 10), cas non couverts par credit-payment.test.ts
 * (qui couvre déjà : 5 % arrondi à l'inférieur, 1 bonus par filleul, sans parrain).
 */
setupFakeSaspayEnv();
restoreRechargeStateAfterAll();
const db = adminClient();
const created: string[] = [];

async function user(o: Parameters<typeof makeUser>[0] = {}) {
  const u = await makeUser(o);
  created.push(u.id);
  return u;
}
async function codeOf(id: string): Promise<string> {
  const { data } = await db.from('profiles').select('referral_code').eq('id', id).single();
  return data!.referral_code as string;
}
async function pair() {
  const parrain = await user();
  const filleul = await user({ referral: await codeOf(parrain.id) });
  return { parrain, filleul };
}
const bonusTx = async (id: string) =>
  (await db.from('wallet_transactions').select('*').eq('user_id', id).eq('type', 'referral_bonus'))
    .data ?? [];
const rewards = async (refereeId: string) =>
  (await db.from('referral_rewards').select('*').eq('referee_id', refereeId)).data ?? [];

beforeAll(async () => {
  await db.from('settings').upsert({ key: 'referral_pct', value: 5 });
});
beforeEach(async () => {
  await setRechargeSettings();
});
afterEach(async () => {
  while (created.length) await removeUser(created.pop()!);
});

/** Recharge réelle de 3 000 XAF réglée côté faux SasPay ; retourne le webhook prêt à envoyer. */
async function webhookFor(userId: string, outcome: 'SUCCESS' | 'FAILED' = 'SUCCESS') {
  const { id } = await createPayment(userId, 3000, randomUUID());
  const p = await paymentOf(id);
  const { data } = getFakeSaspay().settle(p.saspay_session_id as string, outcome);
  const withMeta: WebhookData = { ...data, metadata: { lyonpanel_payment_id: id } };
  const event = outcome === 'SUCCESS' ? 'transaction.success' : 'transaction.failed';
  return { id, ...buildWebhook({ event, data: withMeta }) };
}

describe('bonus de parrainage via webhook SasPay', () => {
  it('3 000 XAF du filleul : le parrain reçoit 150 XAF, le filleul 3 000 XAF', async () => {
    const { parrain, filleul } = await pair();
    const w = await webhookFor(filleul.id);
    expect(await handleSaspayWebhook(w.rawBody, w.headers)).toBe('credited');
    expect((await walletOf(parrain.id)).balance_xaf).toBe(150);
    expect((await walletOf(filleul.id)).balance_xaf).toBe(3000);
  });

  it('le même webhook reçu 3 fois : un seul bonus (une ligne de journal, un seul crédit)', async () => {
    const { parrain, filleul } = await pair();
    const w = await webhookFor(filleul.id);
    for (let i = 0; i < 3; i++) await handleSaspayWebhook(w.rawBody, w.headers);
    expect((await walletOf(parrain.id)).balance_xaf).toBe(150);
    expect(await bonusTx(parrain.id)).toHaveLength(1);
    expect(await rewards(filleul.id)).toHaveLength(1);
    // Journal du paiement : une recharge + un bonus, jamais deux de chaque.
    const types = (await journalOf(w.id)).map((t) => t.type).sort();
    expect(types).toEqual(['recharge', 'referral_bonus']);
  });

  it('deux webhooks identiques en parallèle : un seul bonus', async () => {
    const { parrain, filleul } = await pair();
    const w = await webhookFor(filleul.id);
    await Promise.all([
      handleSaspayWebhook(w.rawBody, w.headers),
      handleSaspayWebhook(w.rawBody, w.headers),
    ]);
    expect((await walletOf(parrain.id)).balance_xaf).toBe(150);
    expect(await bonusTx(parrain.id)).toHaveLength(1);
  });

  it('une recharge en échec ne donne aucun bonus', async () => {
    const { parrain, filleul } = await pair();
    const w = await webhookFor(filleul.id, 'FAILED');
    await handleSaspayWebhook(w.rawBody, w.headers);
    expect((await walletOf(parrain.id)).balance_xaf).toBe(0);
    expect(await bonusTx(parrain.id)).toHaveLength(0);
    expect(await rewards(filleul.id)).toHaveLength(0);
  });

  it('une recharge créée mais jamais payée ne donne aucun bonus', async () => {
    const { parrain, filleul } = await pair();
    await makePayment(filleul.id);
    expect((await walletOf(parrain.id)).balance_xaf).toBe(0);
    expect(await rewards(filleul.id)).toHaveLength(0);
  });

  it('échec puis deux recharges réussies : un seul bonus, sur la première réussie', async () => {
    const { parrain, filleul } = await pair();
    const failed = await webhookFor(filleul.id, 'FAILED');
    await handleSaspayWebhook(failed.rawBody, failed.headers);
    const ok1 = await webhookFor(filleul.id);
    const ok2 = await webhookFor(filleul.id);
    await handleSaspayWebhook(ok1.rawBody, ok1.headers);
    await handleSaspayWebhook(ok2.rawBody, ok2.headers);
    expect((await walletOf(parrain.id)).balance_xaf).toBe(150);
    expect(await bonusTx(parrain.id)).toHaveLength(1);
    expect((await rewards(filleul.id))[0].payment_id).toBe(ok1.id);
  });
});

describe('rattachement au parrain', () => {
  it('un code inconnu est ignoré : compte créé, pas de parrain, pas de bonus', async () => {
    const u = await user({ referral: 'ZZZZ9999' });
    const { data } = await db.from('profiles').select('referred_by').eq('id', u.id).single();
    expect(data?.referred_by).toBeNull();
    const w = await webhookFor(u.id);
    await handleSaspayWebhook(w.rawBody, w.headers);
    expect(await rewards(u.id)).toHaveLength(0);
  });

  it('auto-parrainage refusé : un client ne peut pas être son propre parrain, aucun bonus', async () => {
    const u = await user();
    // Contournement par écriture directe (service) : la base doit le refuser.
    const { error } = await db.from('profiles').update({ referred_by: u.id }).eq('id', u.id);
    expect(error).not.toBeNull();
    const w = await webhookFor(u.id);
    await handleSaspayWebhook(w.rawBody, w.headers);
    expect(await rewards(u.id)).toHaveLength(0);
    expect(await bonusTx(u.id)).toHaveLength(0);
  });
});
