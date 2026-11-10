import { assertCronSecret } from '@/server/http/cron-auth';
import { handler } from '@/server/http/handler';
import { reconcilePendingPayments } from '@/server/payments/reconcile';

// Rattrapage des recharges en attente, appelé toutes les 5 min par le Worker Cloudflare.
export const GET = handler(async (req) => {
  assertCronSecret(req);
  return reconcilePendingPayments();
});
