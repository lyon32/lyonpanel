import 'server-only';
import { z } from 'zod';
import {
  PAYMENT_COLUMNS,
  creditSettlement,
  markPaymentFailed,
  type PaymentRow,
} from './settle-payment';
import { createAdminClient } from '@/server/db/supabase-admin';
import type { Json } from '@/server/db/types';
import { getSaspay } from '@/server/providers/saspay-client';

/**
 * 'rejected' = signature ou horodatage invalide (la route répond 403).
 * 'ignored' = webhook signé mais sans effet (événement inconnu, paiement introuvable,
 * montant différent : le propriétaire est alors alerté). Tous les autres cas répondent 200.
 */
export type WebhookResult = 'credited' | 'duplicate' | 'failed' | 'rejected' | 'ignored';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Nombre de recharges en attente interrogées quand le webhook ne dit pas à quel paiement il se rapporte.
const SCAN_LIMIT = 50;

const payloadSchema = z.object({
  event: z.string(),
  data: z.looseObject({
    id: z.string().min(1),
    status: z.string().optional(),
    net_amount: z.string().optional(),
    fee: z.string().optional(),
    charged: z.string().optional(),
    network: z.string().optional(),
    metadata: z.looseObject({ lyonpanel_payment_id: z.string().optional() }).nullish(),
  }),
});
type WebhookData = z.infer<typeof payloadSchema>['data'];

const db = () => createAdminClient();

async function findById(id: string): Promise<PaymentRow | null> {
  const { data, error } = await db()
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`paiement: ${error.message}`);
  return data;
}

/**
 * Retrouve la recharge d'un webhook : d'abord par metadata (si SasPay la renvoie), sinon par
 * l'identifiant de transaction, sinon en demandant à SasPay la transaction de chaque session récente.
 * Une metadata présente est la seule source : pas de repli, pour ne pas créditer un autre paiement.
 */
async function findPayment(data: WebhookData): Promise<PaymentRow | null> {
  const metaId = data.metadata?.lyonpanel_payment_id;
  if (metaId !== undefined) return UUID.test(metaId) ? findById(metaId) : null;

  const byTx = await db()
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('saspay_transaction_id', data.id)
    .maybeSingle();
  if (byTx.error) throw new Error(`paiement: ${byTx.error.message}`);
  if (byTx.data) return byTx.data;

  const { data: pending, error } = await db()
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(SCAN_LIMIT);
  if (error) throw new Error(`paiements en attente: ${error.message}`);
  const saspay = getSaspay();
  for (const row of pending) {
    try {
      const session = await saspay.getCheckoutSessionStatus(row.saspay_session_id);
      if (session.transactionId === data.id) return row;
    } catch {
      // Session illisible : on passe à la suivante, le rattrapage reverra celle-ci.
    }
  }
  return null;
}

/** Charge gardée en base : le numéro de téléphone du payeur (msisdn) n'est pas conservé. */
function sanitize(event: string, data: WebhookData): Json {
  const rest = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'msisdn'));
  return JSON.parse(JSON.stringify({ event, data: rest })) as Json;
}

/**
 * Traite un webhook SasPay. La signature se vérifie sur le corps BRUT, avant toute lecture du JSON.
 * Le crédit passe uniquement par credit_payment (via creditSettlement) ; un doublon ne crédite jamais deux fois.
 */
export async function handleSaspayWebhook(
  rawBody: string,
  headers: Headers,
): Promise<WebhookResult> {
  const signature = headers.get('x-webhook-signature');
  const timestamp = headers.get('x-webhook-timestamp');
  if (!signature || !timestamp) return 'rejected';
  if (!getSaspay().verifyWebhook(rawBody, signature, timestamp)) return 'rejected';

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return 'ignored';
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return 'ignored';
  const { event, data } = parsed.data;

  // Événements connus seulement (webhook.test, remboursements… : rien à faire).
  if (!['transaction.success', 'transaction.failed', 'transaction.cancelled'].includes(event)) {
    return 'ignored';
  }
  const payment = await findPayment(data);
  if (!payment) return 'ignored';

  const raw = sanitize(event, data);
  if (event !== 'transaction.success') {
    // Jamais de rétrogradation : un paiement déjà crédité ou déjà échoué reste tel quel.
    return (await markPaymentFailed(payment.id, raw)) ? 'failed' : 'duplicate';
  }
  // Le corps du webhook n'est jamais cru pour créditer : on redemande la transaction à SasPay.
  // Pas de try/catch : une panne remonte (5xx) pour que SasPay renvoie le webhook plus tard.
  const verified = await getSaspay().verifyPayment(data.id);
  if (verified.status !== 'SUCCESS') return 'ignored';

  return creditSettlement(payment, {
    transactionId: data.id,
    netAmount: verified.netAmount,
    fee: verified.fee,
    charged: verified.charged,
    network: data.network ?? null,
    raw,
  });
}
