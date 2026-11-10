import { assertCronSecret } from '@/server/http/cron-auth';
import { handler } from '@/server/http/handler';
import { recoverStuckOrders } from '@/server/orders/recover-stuck-orders';
import { syncOrderStatuses } from '@/server/orders/sync-order-statuses';

// Suivi des commandes, appelé toutes les 10 min par le Worker Cloudflare.
export const GET = handler(async (req) => {
  assertCronSecret(req);
  const sync = await syncOrderStatuses();
  const recovered = await recoverStuckOrders();
  return { sync, recovered };
});
