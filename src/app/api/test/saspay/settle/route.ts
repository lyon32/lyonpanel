import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createAdminClient } from '@/server/db/supabase-admin';
import { loadServerEnv } from '@/server/env';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { getFakeSaspay } from '@/server/providers/saspay-client';

const bodySchema = z.object({
  payment_id: z.uuid(),
  outcome: z.enum(['SUCCESS', 'FAILED', 'CANCELLED']),
  net_amount: z.string().optional(),
});

const sha256 = (text: string) => createHash('sha256').update(text).digest();

// Route réservée aux tests e2e : elle simule le paiement côté faux SasPay.
// Elle n'existe (404) que dans un environnement de test sans clé SasPay, jamais en production.
export const POST = handler(async (req) => {
  const env = loadServerEnv();
  if (
    env.SASPAY_MODE !== 'test' ||
    env.SASPAY_API_KEY ||
    process.env.NODE_ENV === 'production' ||
    env.VERCEL_ENV === 'production'
  ) {
    apiError('NOT_FOUND');
  }
  const secret = env.SASPAY_WEBHOOK_SECRET;
  const given = req.headers.get('x-test-secret') ?? '';
  if (!secret || !given || !timingSafeEqual(sha256(given), sha256(secret))) apiError('FORBIDDEN');

  const body = await parseBody(req, bodySchema);
  const { data: payment, error } = await createAdminClient()
    .from('payments')
    .select('saspay_session_id')
    .eq('id', body.payment_id)
    .maybeSingle();
  if (error) throw new Error(`paiement: ${error.message}`);
  if (!payment) apiError('PAYMENT_NOT_FOUND');

  return getFakeSaspay().settle(payment.saspay_session_id, body.outcome, {
    netAmount: body.net_amount,
  });
});
