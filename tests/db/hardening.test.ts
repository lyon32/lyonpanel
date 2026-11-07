import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { makePayment } from '../factories/payment';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await removeUser(id);
});

async function funded(balance = 1_000_000) {
  const u = await makeUser();
  created.push(u.id);
  await db.from('wallets').update({ balance_xaf: balance }).eq('user_id', u.id);
  return u;
}

const order = (userId: string, serviceId: number, qty: number) =>
  db.rpc('place_order', {
    p_user: userId,
    p_service: serviceId,
    p_link: 'https://www.tiktok.com/@client_test',
    p_qty: qty,
    p_comments: null,
    p_idem_key: randomUUID(),
  });

async function ordersCount(userId: string) {
  const { count } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

/** Lecture seule dans la base locale. */
function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', 'supabase_db_lyonpanel', 'psql', '-U', 'postgres', '-At', '-c', sql],
    { encoding: 'utf8' },
  ).trim();
}

describe('place_order : bornes de quantité', () => {
  for (const col of ['min_qty', 'max_qty']) {
    it(`ne crée jamais de commande si ${col} est NULL`, async () => {
      const u = await funded();
      const s = await makeService();
      const { error: upErr } = await db
        .from('services')
        .update({ [col]: null })
        .eq('id', s.id);
      if (upErr) {
        expect(upErr.code).toBe('23502'); // not null : insertion impossible, acceptable
        return;
      }
      const { error } = await order(u.id, s.id, 100);
      expect(error?.message).toMatch(/SERVICE_UNAVAILABLE|QUANTITY_OUT_OF_RANGE/);
      expect(await ordersCount(u.id)).toBe(0);
    });
  }

  for (const qty of [0, -5]) {
    it(`refuse la quantité ${qty} avec QUANTITY_OUT_OF_RANGE (pas l'erreur de contrainte)`, async () => {
      const u = await funded();
      const s = await makeService();
      const { error } = await order(u.id, s.id, qty);
      expect(error?.message).toContain('QUANTITY_OUT_OF_RANGE');
      expect(error?.message).not.toContain('orders_quantity_check');
      expect(await ordersCount(u.id)).toBe(0);
    });
  }

  it('refuse 2 000 000 quand max_qty est 10 000', async () => {
    const u = await funded();
    const s = await makeService();
    const { error } = await order(u.id, s.id, 2_000_000);
    expect(error?.message).toContain('QUANTITY_OUT_OF_RANGE');
    expect(await ordersCount(u.id)).toBe(0);
  });
});

describe('anonymize_user : sessions et accès', () => {
  async function connected() {
    const u = await funded();
    const client = await userClient(u.id);
    const { data } = await client.auth.getSession();
    const session = data.session!;
    const s = await makeService();
    const { data: ticket } = await db
      .from('tickets')
      .insert({ user_id: u.id, subject: 'Mon numéro 699000111' })
      .select()
      .single();
    return { u, client, session, s, ticket: ticket! };
  }

  it('ne laisse aucune session, jeton, facteur MFA ni mot de passe dans auth', async () => {
    const { u } = await connected();
    expect(psql(`select count(*) from auth.sessions where user_id='${u.id}'`)).toBe('1');
    const { error } = await db.rpc('anonymize_user', { p_user: u.id });
    expect(error).toBeNull();
    expect(psql(`select count(*) from auth.sessions where user_id='${u.id}'`)).toBe('0');
    expect(psql(`select count(*) from auth.refresh_tokens where user_id='${u.id}'`)).toBe('0');
    expect(psql(`select count(*) from auth.mfa_factors where user_id='${u.id}'`)).toBe('0');
    expect(psql(`select coalesce(encrypted_password,'') from auth.users where id='${u.id}'`)).toBe(
      '',
    );
    expect(psql(`select raw_app_meta_data->'providers' from auth.users where id='${u.id}'`)).toBe(
      '',
    );
  });

  it("l'ancien jeton ne lit plus rien et ne peut plus être renouvelé", async () => {
    const { u, client, session } = await connected();
    await db.rpc('anonymize_user', { p_user: u.id });
    const { data } = await client.from('profiles').select('id');
    expect(data ?? []).toHaveLength(0);
    const { error } = await client.auth.refreshSession({ refresh_token: session.refresh_token });
    expect(error).not.toBeNull();
  });

  it("efface ou masque l'objet des tickets", async () => {
    const { u, ticket } = await connected();
    await db.rpc('anonymize_user', { p_user: u.id });
    const { data } = await db.from('tickets').select('subject').eq('id', ticket.id).single();
    expect(data!.subject).not.toBe('Mon numéro 699000111');
  });

  it("un compte deleted ne peut plus créer ticket, message ni favori (jeton d'avant)", async () => {
    const { u, client, s, ticket } = await connected();
    await db.rpc('anonymize_user', { p_user: u.id });
    const t = await client.from('tickets').insert({ user_id: u.id, subject: 'Après' });
    expect(t.error).not.toBeNull();
    const m = await client
      .from('ticket_messages')
      .insert({ ticket_id: ticket.id, body: 'Après', from_admin: false });
    expect(m.error).not.toBeNull();
    const f = await client.from('favorites').insert({ user_id: u.id, service_id: s.id });
    expect(f.error).not.toBeNull();
    const { count } = await db
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u.id);
    expect(count).toBe(0);
  });
});

describe('credit_payment : statut du paiement', () => {
  const credit = (p: { id: string } & Record<string, unknown>) =>
    db.rpc('credit_payment', {
      p_payment_id: p.id,
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: p.credited_xaf,
      p_fee_xaf: p.fee_xaf,
      p_total_paid: p.total_paid,
      p_network: 'MTN',
      p_raw: { test: true },
    });
  const balance = async (id: string) =>
    (await db.from('wallets').select('balance_xaf').eq('user_id', id).single()).data!.balance_xaf;

  it('refuse un paiement failed : PAYMENT_NOT_PAYABLE, aucun crédit', async () => {
    const u = await funded(0);
    const p = await makePayment(u.id, { status: 'failed' });
    const { error } = await credit(p);
    expect(error?.message).toContain('PAYMENT_NOT_PAYABLE');
    expect(await balance(u.id)).toBe(0);
    const { count } = await db
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u.id);
    expect(count).toBe(0);
  });

  for (const status of ['created', 'pending']) {
    it(`crédite un paiement ${status}`, async () => {
      const u = await funded(0);
      const p = await makePayment(u.id, { status });
      const { data, error } = await credit(p);
      expect(error).toBeNull();
      expect(data.credited).toBe(true);
      expect(await balance(u.id)).toBe(10000);
    });
  }

  it('un paiement déjà succeeded renvoie credited=false sans erreur', async () => {
    const u = await funded(0);
    const p = await makePayment(u.id);
    await credit(p);
    const { data, error } = await credit(p);
    expect(error).toBeNull();
    expect(data.credited).toBe(false);
    expect(await balance(u.id)).toBe(10000);
  });
});

describe('place_order : remise automatique après 50 000 XAF rechargés', () => {
  it('applique 10 % après des recharges cumulant 50 000 XAF', async () => {
    const u = await funded(0);
    for (let i = 0; i < 5; i++) {
      const p = await makePayment(u.id, { credited_xaf: 10000, total_paid: 10300 });
      await db.rpc('credit_payment', {
        p_payment_id: p.id,
        p_saspay_transaction_id: `txn_${randomUUID()}`,
        p_net_amount_xaf: 10000,
        p_fee_xaf: 300,
        p_total_paid: 10300,
        p_network: 'MTN',
        p_raw: {},
      });
    }
    const s = await makeService();
    const { data, error } = await order(u.id, s.id, 100);
    expect(error).toBeNull();
    expect(data.discount_pct).toBe(10);
  });
});
