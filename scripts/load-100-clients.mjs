/* eslint-disable no-console -- script en ligne de commande : la sortie console est le résultat */
// Test de charge 15.4 : 100 clients simultanés, UNIQUEMENT en mode faux et sur Supabase LOCAL.
// Usage : node --env-file=.env.local scripts/load-100-clients.mjs [10,30,100]   (paliers ; défaut 100)
// p50/p95/max : place_order + credit_payment ; la création de comptes est mesurée à part.
// Parcours par client : inscription -> recharge fausse (webhook rejoué 2 fois) -> commandes
// (une rejouée avec la même clé d'idempotence + 2 autres en parallèle = 3 commandes distinctes).
// Aucun secret affiché.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  console.error('Refusé : la base doit être locale (127.0.0.1 / localhost).');
  process.exit(2);
}
if (!key || (process.env.PROVIDER_MODE ?? 'mock') !== 'mock') {
  console.error('Refusé : clé locale absente ou PROVIDER_MODE différent de mock.');
  process.exit(2);
}
// Paliers : STAGES="10,30,100" (ou argument 1). Sinon CLIENTS (défaut 100) en un seul palier.
const stages = (process.argv[2] ?? process.env.STAGES ?? process.env.CLIENTS ?? '100')
  .split(',')
  .map(Number)
  .filter((x) => Number.isInteger(x) && x > 0 && x <= 1000);
if (!stages.length) {
  console.error('Refusé : paliers invalides (entiers de 1 à 1000, séparés par des virgules).');
  process.exit(2);
}
const RECHARGE = 20_000;
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Date.now();
let lat = []; // place_order et credit_payment seulement
let latSignup = []; // création des comptes, mesurée à part
let errors = [];
let rpcRefus = {}; // refus renvoyés par les fonctions SQL, comptés par message
const timed = async (arr, fn) => {
  const t = performance.now();
  try {
    const r = await fn();
    if (r?.error) {
      const m = String(r.error.message).slice(0, 80);
      rpcRefus[m] = (rpcRefus[m] ?? 0) + 1;
    }
    return r;
  } finally {
    arr.push(performance.now() - t);
  }
};

const { data: svc, error: svcErr } = await db
  .from('services')
  .insert({
    id: 8_000_000 + (run % 900_000),
    platform: 'tiktok',
    category: 'views',
    name_fr: 'Vues TikTok (charge)',
    provider_name: 'mock charge',
    provider_type: 'Default',
    cost_usd_1000: 1,
    price_xaf_1000: 1000,
    min_qty: 10,
    max_qty: 10000,
    active: true,
    available: true,
  })
  .select()
  .single();
if (svcErr) {
  console.error('Service de charge impossible :', svcErr.message);
  process.exit(1);
}

async function client(stage, i) {
  const n = `${run}-${stage}-${i}`;
  const { data: u, error: ue } = await timed(latSignup, () =>
    db.auth.admin.createUser({
      email: `client-load-${n}@lyonpanel.test`,
      password: 'Test-only-password-123',
      email_confirm: true,
      user_metadata: { country: 'CM', language: 'fr' },
    }),
  );
  if (ue) throw new Error(`inscription : ${ue.message}`);
  const id = u.user.id;
  const { data: pay, error: pe } = await db
    .from('payments')
    .insert({
      user_id: id,
      saspay_session_id: `sess_${randomUUID()}`,
      credited_xaf: RECHARGE,
      fee_xaf: 600,
      total_paid: RECHARGE + 600,
      pay_currency: 'XAF',
      idem_key: randomUUID(),
    })
    .select()
    .single();
  if (pe) throw new Error(`paiement : ${pe.message}`);
  const txn = `txn_${randomUUID()}`;
  const credit = () =>
    timed(lat, () =>
      db.rpc('credit_payment', {
        p_payment_id: pay.id,
        p_saspay_transaction_id: txn,
        p_net_amount_xaf: RECHARGE,
        p_fee_xaf: 600,
        p_total_paid: RECHARGE + 600,
        p_network: 'MTN',
        p_raw: { load: true },
      }),
    );
  await Promise.all([credit(), credit()]); // webhook en doublon
  const order = (idem) =>
    timed(lat, () =>
      db.rpc('place_order', {
        p_user: id,
        p_service: svc.id,
        p_link: 'https://www.tiktok.com/@client_test/video/7300000000000000000',
        p_qty: 1000,
        p_comments: null,
        p_idem_key: idem,
      }),
    );
  const k1 = randomUUID();
  await Promise.all([order(k1), order(k1), order(randomUUID()), order(randomUUID())]);
  return id;
}

async function runStage(N) {
  lat = [];
  latSignup = [];
  errors = [];
  rpcRefus = {};
  const t0 = performance.now();
  const settled = await Promise.allSettled(Array.from({ length: N }, (_, i) => client(N, i + 1)));
  const wall = (performance.now() - t0) / 1000;
  const ids = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  settled
    .filter((s) => s.status === 'rejected')
    .forEach((s) => errors.push(String(s.reason?.message ?? s.reason)));

  // Mode faux : le faux fournisseur accepte chaque commande puis la termine.
  const { data: orders } = await db
    .from('orders')
    .select('id,status')
    .eq('service_id', svc.id)
    .in('user_id', ids);
  for (const [j, o] of (orders ?? []).entries()) {
    if (o.status === 'pending') {
      await db
        .from('orders')
        .update({ jap_order_id: run * 1000 + j, status: 'in_progress' })
        .eq('id', o.id);
      await db.from('orders').update({ status: 'completed', remains: 0 }).eq('id', o.id);
    }
  }

  // Vérifications de cohérence, client par client
  const problems = [];
  let doubleDebit = 0;
  let doubleCredit = 0;
  let negative = 0;
  let mismatch = 0;
  for (const id of ids) {
    const { data: w } = await db.from('wallets').select('balance_xaf').eq('user_id', id).single();
    const { data: tx } = await db
      .from('wallet_transactions')
      .select('amount_xaf')
      .eq('user_id', id);
    const { data: os } = await db
      .from('orders')
      .select('charged_xaf')
      .eq('user_id', id)
      .eq('service_id', svc.id);
    const sum = tx.reduce((a, t) => a + Number(t.amount_xaf), 0);
    if (tx.filter((t) => Number(t.amount_xaf) > 0).length !== 1) doubleCredit++;
    if (tx.filter((t) => Number(t.amount_xaf) < 0).length !== os.length) doubleDebit++;
    if (os.length !== 3) problems.push(`client ${id} : ${os.length} commandes au lieu de 3`);
    if (Number(w.balance_xaf) < 0) negative++;
    if (
      Number(w.balance_xaf) !== sum ||
      sum !== RECHARGE - os.reduce((a, o) => a + Number(o.charged_xaf), 0)
    )
      mismatch++;
  }
  const { data: after } = await db
    .from('orders')
    .select('status')
    .eq('service_id', svc.id)
    .in('user_id', ids);
  const stillPending = (after ?? []).filter(
    (o) => o.status === 'pending' || o.status === 'in_progress',
  ).length;

  const pct = (arr, q) => {
    const a = [...arr].sort((x, y) => x - y);
    return a.length ? Math.round(a[Math.min(a.length - 1, Math.floor(a.length * q))]) : 0;
  };
  console.log(
    JSON.stringify(
      {
        palier: N,
        clients: N,
        clientsOk: ids.length,
        erreursParcours: errors.length,
        premieresErreurs: errors.slice(0, 3),
        commandes: (after ?? []).length,
        refusSql: rpcRefus,
        attendues: ids.length * 3,
        doubleCredit,
        doubleDebit,
        soldesNegatifs: negative,
        soldesIncoherents: mismatch,
        commandesBloquees: stillPending,
        anomalies: problems.slice(0, 5),
        appelsArgentMesures: lat.length,
        p50ms: pct(lat, 0.5),
        p95ms: pct(lat, 0.95),
        maxMs: pct(lat, 1),
        inscriptions: {
          appels: latSignup.length,
          p50ms: pct(latSignup, 0.5),
          p95ms: pct(latSignup, 0.95),
          maxMs: pct(latSignup, 1),
        },
        dureeTotaleS: Math.round(wall * 10) / 10,
      },
      null,
      2,
    ),
  );
  const ko =
    errors.length ||
    doubleCredit ||
    doubleDebit ||
    negative ||
    mismatch ||
    stillPending ||
    problems.length ||
    ids.length !== N;
  return !ko;
}

let allOk = true;
for (const N of stages) {
  if (!(await runStage(N))) allOk = false;
}
process.exit(allOk ? 0 : 1);
