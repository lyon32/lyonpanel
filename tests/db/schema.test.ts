import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { makePayment } from '../factories/payment';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];

async function user(o: Parameters<typeof makeUser>[0] = {}) {
  const u = await makeUser(o);
  created.push(u.id);
  return u;
}

// Nettoyage au mieux : les lignes de journal immuables bloquent la suppression, c'est voulu.
afterEach(async () => {
  while (created.length) await removeUser(created.pop()!);
});

function tx(userId: string, o: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    type: 'recharge',
    amount_xaf: 1000,
    balance_after_xaf: 1000,
    ref: `ref:${randomUUID()}`,
    ...o,
  };
}

describe('création automatique du profil', () => {
  it('crée profil et portefeuille à solde 0 avec un referral_code de 8 caractères', async () => {
    const u = await user({ country: 'SN', language: 'en' });
    const { data: p, error } = await db.from('profiles').select('*').eq('id', u.id).single();
    expect(error).toBeNull();
    expect(p?.email).toBe(u.email);
    expect(p?.phone).toBe(u.phone);
    expect(p?.country).toBe('SN');
    expect(p?.language).toBe('en');
    expect(p?.referral_code).toHaveLength(8);
    expect(p?.is_admin).toBe(false);
    const { data: w } = await db.from('wallets').select('*').eq('user_id', u.id).single();
    expect(w?.balance_xaf).toBe(0);
    expect(w?.total_recharged_xaf).toBe(0);
  });

  it('relie le filleul à son parrain via la clé referral', async () => {
    const parrain = await user();
    const { data: pp } = await db
      .from('profiles')
      .select('referral_code')
      .eq('id', parrain.id)
      .single();
    const filleul = await user({ referral: pp?.referral_code });
    const { data } = await db.from('profiles').select('referred_by').eq('id', filleul.id).single();
    expect(data?.referred_by).toBe(parrain.id);
  });

  it('donne des referral_code différents à deux clients', async () => {
    const a = await user();
    const b = await user();
    const { data } = await db.from('profiles').select('referral_code').in('id', [a.id, b.id]);
    expect(new Set(data?.map((r) => r.referral_code)).size).toBe(2);
  });
});

describe('unicité des comptes', () => {
  it('refuse deux comptes avec le même téléphone', async () => {
    const a = await user();
    const { data, error } = await db.auth.admin.createUser({
      email: `client-dup-${Date.now()}@lyonpanel.test`,
      phone: a.phone,
      email_confirm: true,
      phone_confirm: true,
    });
    if (data.user) created.push(data.user.id);
    expect(error).not.toBeNull();
  });

  it('refuse deux comptes avec le même email', async () => {
    const a = await user();
    const { data, error } = await db.auth.admin.createUser({ email: a.email, email_confirm: true });
    if (data.user) created.push(data.user.id);
    expect(error).not.toBeNull();
  });

  it('refuse un profil avec un téléphone déjà pris', async () => {
    const a = await user();
    const b = await user();
    const { error } = await db.from('profiles').update({ phone: a.phone }).eq('id', b.id);
    expect(error?.code).toBe('23505');
  });

  it('autorise un seul administrateur', async () => {
    const a = await user();
    const b = await user();
    const r1 = await db.from('profiles').update({ is_admin: true }).eq('id', a.id);
    const r2 = await db.from('profiles').update({ is_admin: true }).eq('id', b.id);
    expect(r1.error?.code).not.toBe('PGRST205');
    expect([r1.error, r2.error].some((e) => e !== null)).toBe(true);
    const { data } = await db.from('profiles').select('id').eq('is_admin', true);
    expect(data?.length ?? 0).toBeLessThanOrEqual(1);
    await db.from('profiles').update({ is_admin: false }).in('id', [a.id, b.id]);
  });

  it.each([-1, 50.01, 100])('refuse une remise personnalisée de %s %%', async (pct) => {
    const u = await user();
    const { error } = await db.from('profiles').update({ custom_discount_pct: pct }).eq('id', u.id);
    expect(error?.code).toBe('23514');
  });

  it.each([0, 25, 50])('accepte une remise personnalisée de %s %%', async (pct) => {
    const u = await user();
    const { error } = await db.from('profiles').update({ custom_discount_pct: pct }).eq('id', u.id);
    expect(error).toBeNull();
  });
});

describe('portefeuille et journal', () => {
  it('refuse un solde négatif', async () => {
    const u = await user();
    const { error } = await db.from('wallets').update({ balance_xaf: -1 }).eq('user_id', u.id);
    expect(error?.code).toBe('23514');
  });

  it('refuse une transaction à montant 0', async () => {
    const u = await user();
    const { error } = await db.from('wallet_transactions').insert(tx(u.id, { amount_xaf: 0 }));
    expect(error?.code).toBe('23514');
  });

  it('refuse deux transactions avec la même ref', async () => {
    const u = await user();
    const ref = `ref:${randomUUID()}`;
    const first = await db.from('wallet_transactions').insert(tx(u.id, { ref }));
    expect(first.error).toBeNull();
    const second = await db.from('wallet_transactions').insert(tx(u.id, { ref }));
    expect(second.error?.code).toBe('23505');
  });

  it('refuse de modifier une transaction, même avec la clé de service', async () => {
    const u = await user();
    const { data } = await db.from('wallet_transactions').insert(tx(u.id)).select().single();
    const { error } = await db
      .from('wallet_transactions')
      .update({ amount_xaf: 5 })
      .eq('id', data?.id);
    expect(error).not.toBeNull();
    const { data: after } = await db
      .from('wallet_transactions')
      .select('amount_xaf')
      .eq('id', data?.id)
      .single();
    expect(after?.amount_xaf).toBe(1000);
  });

  it('refuse de supprimer une transaction, même avec la clé de service', async () => {
    const u = await user();
    const { data } = await db.from('wallet_transactions').insert(tx(u.id)).select().single();
    const { error } = await db.from('wallet_transactions').delete().eq('id', data?.id);
    expect(error).not.toBeNull();
    const { data: after } = await db.from('wallet_transactions').select('id').eq('id', data?.id);
    expect(after).toHaveLength(1);
  });
});

describe("journal d'audit", () => {
  const entry = () => ({ action: 'test', target_table: 'profiles', target_id: randomUUID() });

  it('refuse de modifier une ligne, même avec la clé de service', async () => {
    const { data, error: insertError } = await db
      .from('audit_log')
      .insert(entry())
      .select()
      .single();
    expect(insertError).toBeNull();
    const { error } = await db.from('audit_log').update({ action: 'x' }).eq('id', data?.id);
    expect(error).not.toBeNull();
  });

  it('refuse de supprimer une ligne, même avec la clé de service', async () => {
    const { data, error: insertError } = await db
      .from('audit_log')
      .insert(entry())
      .select()
      .single();
    expect(insertError).toBeNull();
    const { error } = await db.from('audit_log').delete().eq('id', data?.id);
    expect(error).not.toBeNull();
    const { data: after } = await db.from('audit_log').select('id').eq('id', data?.id);
    expect(after).toHaveLength(1);
  });
});

describe('services', () => {
  it('refuse min_qty supérieur à max_qty', async () => {
    await expect(makeService({ min_qty: 500, max_qty: 100 })).rejects.toThrow(/check|min/i);
  });

  it('accepte min_qty égal à max_qty', async () => {
    const s = await makeService({ min_qty: 100, max_qty: 100 });
    expect(s.id).toBeGreaterThan(0);
    await db.from('services').delete().eq('id', s.id);
  });

  it('refuse min_qty à 0', async () => {
    await expect(makeService({ min_qty: 0 })).rejects.toThrow();
  });
});

describe('parrainage', () => {
  it('refuse une 2e récompense pour le même filleul', async () => {
    const parrain = await user();
    const filleul = await user();
    const pay = await makePayment(filleul.id);
    const row = {
      referrer_id: parrain.id,
      referee_id: filleul.id,
      payment_id: pay.id,
      amount_xaf: 500,
    };
    const first = await db.from('referral_rewards').insert(row);
    expect(first.error).toBeNull();
    const second = await db.from('referral_rewards').insert(row);
    expect(second.error?.code).toBe('23505');
  });
});

describe('stockage', () => {
  it('contient un bucket ticket-attachments privé', async () => {
    const { data, error } = await db.storage.getBucket('ticket-attachments');
    expect(error).toBeNull();
    expect(data?.public).toBe(false);
  });
});
