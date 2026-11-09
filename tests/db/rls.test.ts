import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import { makePayment } from '../factories/payment';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, TEST_PASSWORD, userClient } from './helpers/client';

const db = adminClient();
const BUCKET = 'ticket-attachments';

// Colonnes que le client a le droit de lire (jamais cost_usd, error, raw_webhook, etc.).
const CLIENT_COLS: Record<string, string> = {
  wallet_transactions: '*',
  tickets: '*',
  favorites: '*',
  payments:
    'id, user_id, saspay_session_id, credited_xaf, fee_xaf, total_paid, pay_currency, status, saspay_network, created_at, succeeded_at',
  orders:
    'id, short_id, user_id, service_id, link, quantity, comments, price_xaf_1000, discount_pct, charged_xaf, status, start_count, remains, created_at, updated_at',
};

function need(value: string | undefined, label: string): string {
  if (value === undefined) throw new Error(`Donnée de test manquante : ${label}`);
  return value;
}

const created: string[] = [];
let a: { id: string; client: SupabaseClient };
let b: { id: string; client: SupabaseClient };
let admin: { id: string; client: SupabaseClient };
let anon: SupabaseClient;
let adminCreated = false;

let serviceActive: number;
let serviceHidden: number;
let serviceUnavailable: number;
const ids = { a: {} as Record<string, string>, b: {} as Record<string, string> };

async function seed(userId: string, side: Record<string, string>, service: number) {
  const pay = await makePayment(userId);
  const order = await makeOrder(userId, service);
  side.payment = pay.id;
  side.order = order.id;
  const { error: txErr } = await db.from('wallet_transactions').insert({
    user_id: userId,
    type: 'recharge',
    amount_xaf: 1000,
    balance_after_xaf: 1000,
    ref: `ref:${randomUUID()}`,
  });
  if (txErr) throw new Error(txErr.message);
  await db.from('favorites').insert({ user_id: userId, service_id: service });
  const { data: t } = await db
    .from('tickets')
    .insert({ user_id: userId, subject: `sujet-${randomUUID()}` })
    .select()
    .single();
  side.ticket = t!.id;
  const { data: m } = await db
    .from('ticket_messages')
    .insert({ ticket_id: t!.id, body: `msg-${randomUUID()}` })
    .select()
    .single();
  side.message = m!.id;
  const path = `${userId}/${randomUUID()}.png`;
  side.path = path;
  await db
    .from('ticket_attachments')
    .insert({ message_id: m!.id, storage_path: path, mime: 'image/png', size_bytes: 10 });
  await db.storage.from(BUCKET).upload(path, new Uint8Array([137, 80, 78, 71]), {
    contentType: 'image/png',
  });
}

beforeAll(async () => {
  const ua = await makeUser();
  const ub = await makeUser();
  created.push(ua.id, ub.id);

  // Un seul administrateur possible : réutiliser celui qui existe, sinon en créer un.
  const { data: existing } = await db.from('profiles').select('id').eq('is_admin', true);
  if (existing && existing.length > 0) {
    const first = existing[0];
    if (!first) throw new Error('Administrateur introuvable');
    admin = { id: first.id, client: undefined as unknown as SupabaseClient };
    await db.auth.admin.updateUserById(admin.id, { password: TEST_PASSWORD });
  } else {
    const uadm = await makeUser();
    created.push(uadm.id);
    await db.from('profiles').update({ is_admin: true }).eq('id', uadm.id);
    adminCreated = true;
    admin = { id: uadm.id, client: undefined as unknown as SupabaseClient };
  }
  admin.client = await userClient(admin.id);

  a = { id: ua.id, client: await userClient(ua.id) };
  b = { id: ub.id, client: await userClient(ub.id) };
  anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  serviceActive = (await makeService({ active: true, available: true })).id;
  serviceHidden = (await makeService({ active: false, available: true })).id;
  serviceUnavailable = (await makeService({ active: true, available: false })).id;

  await seed(a.id, ids.a, serviceActive);
  await seed(b.id, ids.b, serviceActive);
  await db.from('admin_notes').insert({ user_id: a.id, body: 'note interne' });
});

afterAll(async () => {
  if (adminCreated) await db.from('profiles').update({ is_admin: false }).eq('id', admin.id);
  for (const id of created) await removeUser(id);
});

describe('lecture de ses propres données (RLS)', () => {
  it('A lit son profil et pas celui de B', async () => {
    const { data, error } = await a.client.from('profiles').select('id');
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([a.id]);
  });

  it('A lit son portefeuille et pas celui de B', async () => {
    const { data, error } = await a.client.from('wallets').select('user_id');
    expect(error).toBeNull();
    expect(data?.map((r) => r.user_id)).toEqual([a.id]);
  });

  it.each([
    ['wallet_transactions', 'user_id'],
    ['payments', 'user_id'],
    ['orders', 'user_id'],
    ['tickets', 'user_id'],
    ['favorites', 'user_id'],
  ])('A lit ses lignes de %s et aucune de B', async (table, col) => {
    const cols = CLIENT_COLS[table] ?? '*';
    const own = await a.client.from(table).select(cols).eq(col, a.id);
    expect(own.error).toBeNull();
    expect(own.data?.length).toBeGreaterThan(0);
    const other = await a.client.from(table).select(cols).eq(col, b.id);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
    const all = await a.client.from(table).select(cols);
    expect(
      (all.data as unknown as Record<string, unknown>[] | null)?.every((r) => r[col] === a.id),
    ).toBe(true);
  });

  it('A lit ses messages de ticket et pas ceux de B', async () => {
    const { data, error } = await a.client.from('ticket_messages').select('id');
    expect(error).toBeNull();
    const got = data?.map((r) => r.id) ?? [];
    expect(got).toContain(ids.a.message);
    expect(got).not.toContain(ids.b.message);
  });

  it('A lit ses pièces jointes et pas celles de B', async () => {
    const { data, error } = await a.client.from('ticket_attachments').select('storage_path');
    expect(error).toBeNull();
    const got = data?.map((r) => r.storage_path) ?? [];
    expect(got).toContain(ids.a.path);
    expect(got).not.toContain(ids.b.path);
  });
});

describe('colonnes sensibles illisibles pour un client', () => {
  it.each([
    ['orders', 'cost_usd'],
    ['orders', 'error'],
    ['payments', 'raw_webhook'],
    ['profiles', 'blocked_reason'],
    ['profiles', 'custom_discount_pct'],
    ['profiles', 'is_admin'],
  ])('A ne peut pas lire %s.%s (erreur de permission)', async (table, col) => {
    const { error } = await a.client.from(table).select(col);
    expect(error?.code).toBe('42501');
  });

  it('A ne peut pas lire une colonne sensible avec select(*)', async () => {
    for (const table of ['orders', 'payments', 'profiles']) {
      const { error } = await a.client.from(table).select('*');
      expect(error?.code).toBe('42501');
    }
  });

  it('A lit ses colonnes autorisées de orders, payments et profiles', async () => {
    const o = await a.client
      .from('orders')
      .select('price_xaf_1000, charged_xaf, status, quantity, link')
      .eq('id', ids.a.order);
    expect(o.error).toBeNull();
    expect(o.data).toEqual([
      expect.objectContaining({
        charged_xaf: 150,
        status: 'pending',
        quantity: expect.any(Number),
      }),
    ]);
    const p = await a.client
      .from('payments')
      .select('credited_xaf, status')
      .eq('id', ids.a.payment);
    expect(p.error).toBeNull();
    expect(p.data).toHaveLength(1);
    const pr = await a.client
      .from('profiles')
      .select('id, language, country, status')
      .eq('id', a.id);
    expect(pr.error).toBeNull();
    expect(pr.data).toHaveLength(1);
  });
});

describe('écriture interdite sur les tables d argent', () => {
  it('A ne peut pas modifier son solde', async () => {
    await a.client.from('wallets').update({ balance_xaf: 999999 }).eq('user_id', a.id);
    const { data } = await db.from('wallets').select('balance_xaf').eq('user_id', a.id).single();
    expect(data?.balance_xaf).toBe(0);
  });

  it('A ne peut pas insérer ni supprimer dans wallets', async () => {
    const ins = await a.client.from('wallets').insert({ user_id: a.id, balance_xaf: 5 });
    expect(ins.error).not.toBeNull();
    await a.client.from('wallets').delete().eq('user_id', a.id);
    const { data } = await db.from('wallets').select('user_id').eq('user_id', a.id);
    expect(data).toHaveLength(1);
  });

  it('A ne peut rien écrire dans wallet_transactions', async () => {
    const ref = `ref:${randomUUID()}`;
    const ins = await a.client.from('wallet_transactions').insert({
      user_id: a.id,
      type: 'recharge',
      amount_xaf: 5000,
      balance_after_xaf: 5000,
      ref,
    });
    expect(ins.error).not.toBeNull();
    await a.client.from('wallet_transactions').update({ amount_xaf: 1 }).eq('user_id', a.id);
    await a.client.from('wallet_transactions').delete().eq('user_id', a.id);
    const { data } = await db
      .from('wallet_transactions')
      .select('amount_xaf, ref')
      .eq('user_id', a.id);
    expect(data?.some((r) => r.ref === ref)).toBe(false);
    expect(data?.every((r) => r.amount_xaf === 1000)).toBe(true);
  });

  it('A ne peut rien écrire dans payments', async () => {
    const ins = await a.client.from('payments').insert({
      user_id: a.id,
      saspay_session_id: `sess_${randomUUID()}`,
      credited_xaf: 10000,
      fee_xaf: 0,
      total_paid: 10000,
      pay_currency: 'XAF',
      status: 'succeeded',
      idem_key: randomUUID(),
    });
    expect(ins.error).not.toBeNull();
    await a.client.from('payments').update({ status: 'succeeded' }).eq('id', ids.a.payment);
    await a.client.from('payments').delete().eq('id', ids.a.payment);
    const { data } = await db.from('payments').select('status').eq('id', ids.a.payment).single();
    expect(data?.status).toBe('created');
  });

  it('A ne peut rien écrire dans orders', async () => {
    const ins = await a.client.from('orders').insert({
      user_id: a.id,
      service_id: serviceActive,
      link: 'https://www.tiktok.com/@x',
      quantity: 100,
      price_xaf_1000: 1,
      charged_xaf: 1,
      idem_key: randomUUID(),
    });
    expect(ins.error).not.toBeNull();
    await a.client
      .from('orders')
      .update({ charged_xaf: 1, status: 'refunded' })
      .eq('id', ids.a.order);
    await a.client.from('orders').delete().eq('id', ids.a.order);
    const { data } = await db
      .from('orders')
      .select('charged_xaf, status')
      .eq('id', ids.a.order)
      .single();
    expect(data).toEqual({ charged_xaf: 150, status: 'pending' });
  });
});

describe('modification de son profil', () => {
  it('A modifie son language', async () => {
    const { error } = await a.client.from('profiles').update({ language: 'en' }).eq('id', a.id);
    expect(error).toBeNull();
    const { data } = await db.from('profiles').select('language').eq('id', a.id).single();
    expect(data?.language).toBe('en');
  });

  it.each([
    ['status', 'blocked'],
    ['is_admin', true],
    ['custom_discount_pct', 50],
  ])('A ne peut pas modifier %s', async (col, value) => {
    await a.client
      .from('profiles')
      .update({ [col]: value })
      .eq('id', a.id);
    const { data } = await db.from('profiles').select(col).eq('id', a.id).single();
    expect(data?.[col as keyof typeof data]).not.toBe(value);
  });

  it('A ne peut pas modifier referred_by', async () => {
    await a.client.from('profiles').update({ referred_by: b.id }).eq('id', a.id);
    const { data } = await db.from('profiles').select('referred_by').eq('id', a.id).single();
    expect(data?.referred_by).toBeNull();
  });

  it('A ne peut pas modifier le profil de B', async () => {
    await a.client.from('profiles').update({ language: 'en' }).eq('id', b.id);
    const { data } = await db.from('profiles').select('language').eq('id', b.id).single();
    expect(data?.language).toBe('fr');
  });
});

describe('favoris, tickets et messages', () => {
  it('A crée et supprime ses favoris', async () => {
    const svc = (await makeService()).id;
    const ins = await a.client.from('favorites').insert({ user_id: a.id, service_id: svc });
    expect(ins.error).toBeNull();
    const del = await a.client.from('favorites').delete().eq('service_id', svc);
    expect(del.error).toBeNull();
    const { data } = await db.from('favorites').select('*').eq('service_id', svc);
    expect(data).toEqual([]);
  });

  it('A ne peut pas créer un favori pour B', async () => {
    const svc = (await makeService()).id;
    const ins = await a.client.from('favorites').insert({ user_id: b.id, service_id: svc });
    expect(ins.error).not.toBeNull();
  });

  it('A crée un ticket et un message pour lui-même', async () => {
    const t = await a.client
      .from('tickets')
      .insert({ user_id: a.id, subject: `sujet-${randomUUID()}` })
      .select()
      .single();
    expect(t.error).toBeNull();
    const m = await a.client
      .from('ticket_messages')
      .insert({ ticket_id: t.data!.id, body: 'bonjour', from_admin: false })
      .select()
      .single();
    expect(m.error).toBeNull();
    const att = await a.client.from('ticket_attachments').insert({
      message_id: m.data!.id,
      storage_path: `${a.id}/${randomUUID()}.png`,
      mime: 'image/png',
      size_bytes: 10,
    });
    expect(att.error).toBeNull();
  });

  it('A ne peut pas créer un ticket au nom de B', async () => {
    const t = await a.client.from('tickets').insert({ user_id: b.id, subject: 'faux' });
    expect(t.error).not.toBeNull();
  });

  it('A ne peut pas écrire dans le ticket de B', async () => {
    const m = await a.client
      .from('ticket_messages')
      .insert({ ticket_id: ids.b.ticket, body: 'intrus' });
    expect(m.error).not.toBeNull();
    const att = await a.client.from('ticket_attachments').insert({
      message_id: ids.b.message,
      storage_path: `${a.id}/${randomUUID()}.png`,
      mime: 'image/png',
      size_bytes: 10,
    });
    expect(att.error).not.toBeNull();
    await a.client.from('tickets').update({ subject: 'piraté' }).eq('id', ids.b.ticket);
    const { data } = await db.from('tickets').select('subject').eq('id', ids.b.ticket).single();
    expect(data?.subject).not.toBe('piraté');
    const { data: msgs } = await db
      .from('ticket_messages')
      .select('body')
      .eq('ticket_id', ids.b.ticket);
    expect(msgs?.some((r) => r.body === 'intrus')).toBe(false);
  });

  it('A ne peut pas se faire passer pour l admin dans un message', async () => {
    const m = await a.client
      .from('ticket_messages')
      .insert({ ticket_id: ids.a.ticket, body: 'faux admin', from_admin: true });
    expect(m.error).not.toBeNull();
  });
});

describe('tables internes illisibles pour un client', () => {
  it.each([
    'admin_notes',
    'settings',
    'audit_log',
    'referral_rewards',
    'service_price_history',
    'provider_balance_snapshots',
    'login_attempts',
    'rate_limits',
    'allowed_signups',
    'idempotency_keys',
    'services',
  ])('A ne lit rien de %s', async (table) => {
    const { data } = await a.client.from(table).select('*');
    expect(data ?? []).toEqual([]);
  });
});

describe('vue services_public', () => {
  it('n expose ni provider_name, ni provider_type, ni cost_usd_1000, ni multiplier', async () => {
    const { data, error } = await a.client.from('services_public').select('*').limit(1);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    const cols = Object.keys(data![0]);
    expect(cols).not.toContain('provider_name');
    expect(cols).not.toContain('provider_type');
    expect(cols).not.toContain('cost_usd_1000');
    expect(cols).not.toContain('multiplier');
    expect(cols).toContain('price_xaf_1000');
  });

  it('ne contient que les services actifs et disponibles', async () => {
    const { data, error } = await a.client.from('services_public').select('id');
    expect(error).toBeNull();
    const got = data?.map((r) => r.id) ?? [];
    expect(got).toContain(serviceActive);
    expect(got).not.toContain(serviceHidden);
    expect(got).not.toContain(serviceUnavailable);
  });
});

describe('administrateur', () => {
  it('lit les données de tous les clients et les tables internes', async () => {
    const profiles = await admin.client.from('profiles').select('id').in('id', [a.id, b.id]);
    expect(profiles.data).toHaveLength(2);
    for (const table of ['orders', 'payments', 'wallet_transactions', 'tickets', 'services']) {
      const { data, error } = await admin.client.from(table).select('id');
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
    }
    const notes = await admin.client.from('admin_notes').select('*');
    expect(notes.data?.length).toBeGreaterThan(0);
    const settings = await admin.client.from('settings').select('*');
    expect(settings.data?.length).toBeGreaterThan(0);
  });
});

describe('fonctions d argent', () => {
  const calls: [string, Record<string, unknown>][] = [
    [
      'place_order',
      {
        p_user: randomUUID(),
        p_service: 1,
        p_link: 'https://x.test',
        p_qty: 100,
        p_comments: null,
        p_idem_key: randomUUID(),
        p_expected_price_xaf_1000: null,
      },
    ],
    [
      'credit_payment',
      {
        p_payment_id: randomUUID(),
        p_saspay_transaction_id: 'tx',
        p_net_amount_xaf: 1000,
        p_fee_xaf: 0,
        p_total_paid: 1000,
        p_network: 'MTN',
        p_raw: {},
      },
    ],
    ['refund_order', { p_order: randomUUID(), p_amount: 100, p_admin: randomUUID() }],
    ['admin_adjust', { p_user: randomUUID(), p_amount: 100, p_note: 'x', p_admin: randomUUID() }],
    ['anonymize_user', { p_user: randomUUID() }],
  ];

  it.each(calls)('un client connecté ne peut pas exécuter %s (droit refusé)', async (fn, args) => {
    const { error } = await a.client.rpc(fn, args);
    expect(error?.code).toBe('42501');
  });

  it.each(calls)('le visiteur anonyme ne peut pas exécuter %s (droit refusé)', async (fn, args) => {
    const { error } = await anon.rpc(fn, args);
    expect(error?.code).toBe('42501');
  });
});

describe('visiteur anonyme', () => {
  it.each([
    'profiles',
    'wallets',
    'wallet_transactions',
    'payments',
    'orders',
    'tickets',
    'ticket_messages',
    'ticket_attachments',
    'favorites',
    'admin_notes',
    'settings',
    'audit_log',
    'referral_rewards',
    'service_price_history',
    'provider_balance_snapshots',
    'login_attempts',
    'rate_limits',
    'allowed_signups',
    'idempotency_keys',
    'services',
  ])('ne lit rien de %s', async (table) => {
    const { data } = await anon.from(table).select('*');
    expect(data ?? []).toEqual([]);
  });

  it('lit seulement les services actifs et disponibles via services_public', async () => {
    const { data, error } = await anon.from('services_public').select('id');
    expect(error).toBeNull();
    const got = data?.map((r) => r.id) ?? [];
    expect(got).toContain(serviceActive);
    expect(got).not.toContain(serviceHidden);
    expect(got).not.toContain(serviceUnavailable);
  });
});

describe('Storage ticket-attachments (chemin <user_id>/<fichier>)', () => {
  it('A télécharge son fichier', async () => {
    const { data, error } = await a.client.storage
      .from(BUCKET)
      .download(need(ids.a.path, 'ids.a.path'));
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('A ne télécharge pas le fichier de B', async () => {
    const { data } = await a.client.storage.from(BUCKET).download(need(ids.b.path, 'ids.b.path'));
    expect(data).toBeNull();
  });

  it('A ne liste que son dossier', async () => {
    const own = await a.client.storage.from(BUCKET).list(a.id);
    expect(own.data?.length).toBeGreaterThan(0);
    const other = await a.client.storage.from(BUCKET).list(b.id);
    expect(other.data ?? []).toEqual([]);
  });

  it('A envoie un fichier dans son dossier', async () => {
    const { error } = await a.client.storage
      .from(BUCKET)
      .upload(`${a.id}/${randomUUID()}.png`, new Uint8Array([137, 80, 78, 71]), {
        contentType: 'image/png',
      });
    expect(error).toBeNull();
  });

  it('A ne peut pas écrire ni supprimer dans le dossier de B', async () => {
    const up = await a.client.storage
      .from(BUCKET)
      .upload(`${b.id}/${randomUUID()}.png`, new Uint8Array([1, 2, 3]), {
        contentType: 'image/png',
      });
    expect(up.error).not.toBeNull();
    await a.client.storage.from(BUCKET).remove([need(ids.b.path, 'ids.b.path')]);
    const still = await db.storage.from(BUCKET).download(need(ids.b.path, 'ids.b.path'));
    expect(still.error).toBeNull();
  });

  it('le visiteur anonyme ne lit aucun fichier', async () => {
    const { data } = await anon.storage.from(BUCKET).download(need(ids.a.path, 'ids.a.path'));
    expect(data).toBeNull();
  });
});
