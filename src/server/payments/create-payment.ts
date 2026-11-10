import 'server-only';
import { randomUUID } from 'node:crypto';
import { quotePayment, type Quote } from './quote';
import { SITE_URL } from '@/lib/constants';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { getSaspay } from '@/server/providers/saspay-client';

// Une recharge non payée expire au bout de 30 minutes (décision du 2026-11-10).
export const PAYMENT_EXPIRY_MINUTES = 30;

// Pays payés en XOF ; tous les autres pays acceptés au lancement paient en XAF (1 XOF = 1 XAF).
const XOF_COUNTRIES = new Set(['SN', 'CI', 'BJ', 'BF', 'ML', 'NE', 'TG', 'GW']);

// Attente maximale d'une demande jumelle (même clé) qui est en train de créer la session.
const TWIN_WAIT_MS = 15_000;
const TWIN_POLL_MS = 100;

type Profile = {
  email: string | null;
  phone: string | null;
  country: string;
  language: string;
  status: string;
};

type CreatedPayment = { id: string; checkoutUrl: string };

/** Page de retour de SasPay, dans la langue du client (adresses de LLD §6). */
function returnUrlFor(paymentId: string, language: string): string {
  const path = language === 'en' ? 'en/add-funds' : 'fr/recharger';
  return `${SITE_URL}/${path}/${paymentId}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select('email, phone, country, language, status')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profil: ${error.message}`);
  if (!data) return apiError('USER_NOT_FOUND');
  if (data.status === 'blocked' || data.status === 'deleted') return apiError('ACCOUNT_BLOCKED');
  return data;
}

/**
 * Cas où la clé d'idempotence existe déjà : on renvoie la même réponse que la première fois.
 * Si une demande jumelle crée encore la session SasPay, on l'attend (jamais de seconde session).
 */
async function replay(
  idemKey: string,
  userId: string,
  amountXaf: number,
  language: string,
): Promise<CreatedPayment> {
  const db = createAdminClient();
  const deadline = Date.now() + TWIN_WAIT_MS;
  for (;;) {
    const { data, error } = await db
      .from('payments')
      .select('id, user_id, credited_xaf, status, raw_webhook')
      .eq('idem_key', idemKey)
      .single();
    if (error) throw new Error(`paiement: ${error.message}`);
    // Même clé mais autre client ou autre montant : refusé, rien n'est renvoyé de l'autre paiement.
    if (data.user_id !== userId || data.credited_xaf !== amountXaf) {
      return apiError('IDEMPOTENCY_CONFLICT');
    }
    if (data.status === 'failed') return apiError('PROVIDER_ERROR');
    if (data.status !== 'created') {
      // L'adresse de paiement est gardée dans raw_webhook jusqu'au webhook ; ensuite, la page de statut suffit.
      const raw = data.raw_webhook as { checkout_url?: unknown } | null;
      const url = typeof raw?.checkout_url === 'string' ? raw.checkout_url : null;
      return { id: data.id, checkoutUrl: url ?? returnUrlFor(data.id, language) };
    }
    if (Date.now() > deadline) return apiError('PROVIDER_TIMEOUT');
    await sleep(TWIN_POLL_MS);
  }
}

/**
 * Crée une recharge : devis (serveur) -> ligne `created` -> session SasPay (ADD_ON, +30 min) -> `pending`.
 * La session n'est JAMAIS recréée automatiquement : un échec marque la ligne `failed` et le client
 * recommence avec une nouvelle clé. Le solde ne bouge pas ici : seul credit_payment crédite.
 */
export async function createPayment(
  userId: string,
  amountXaf: number,
  idempotencyKey: string,
): Promise<CreatedPayment> {
  const quote: Quote = await quotePayment(amountXaf);
  const profile = await loadProfile(userId);
  const db = createAdminClient();
  const currency = XOF_COUNTRIES.has(profile.country) ? 'XOF' : 'XAF';

  const id = randomUUID();
  const { error: insertError } = await db.from('payments').insert({
    id,
    user_id: userId,
    // Valeur provisoire (colonne obligatoire et unique) : remplacée dès que SasPay répond.
    saspay_session_id: `init:${id}`,
    credited_xaf: quote.amountXaf,
    fee_xaf: quote.feeXaf,
    total_paid: quote.totalToPay,
    pay_currency: currency,
    status: 'created',
    idem_key: idempotencyKey,
  });
  if (insertError) {
    // 23505 = clé déjà utilisée : c'est un rejeu (ou une demande en parallèle), pas une panne.
    if (insertError.code === '23505') {
      return replay(idempotencyKey, userId, amountXaf, profile.language);
    }
    throw new Error(`création du paiement: ${insertError.message}`);
  }

  let session: { sessionId: string; checkoutUrl: string };
  try {
    session = await getSaspay().createCheckoutSession({
      amount: `${quote.amountXaf}.00`,
      currency,
      customerEmail: profile.email ?? '',
      // SasPay exige un nom : à défaut, l'adresse email (docs/06-saspay.md §2).
      customerName: profile.email ?? '',
      customerPhone: profile.phone ?? undefined,
      country: profile.country,
      returnUrl: returnUrlFor(id, profile.language),
      metadata: { lyonpanel_payment_id: id },
      feeChargeMode: 'ADD_ON',
      expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000).toISOString(),
    });
  } catch (e) {
    // Pas de nouvel essai : la session a peut-être été créée côté SasPay malgré l'erreur.
    await db.from('payments').update({ status: 'failed' }).eq('id', id).eq('status', 'created');
    throw e;
  }

  const { error: updateError } = await db
    .from('payments')
    .update({
      saspay_session_id: session.sessionId,
      status: 'pending',
      raw_webhook: { checkout_url: session.checkoutUrl },
    })
    .eq('id', id);
  if (updateError) throw new Error(`mise à jour du paiement: ${updateError.message}`);
  return { id, checkoutUrl: session.checkoutUrl };
}
