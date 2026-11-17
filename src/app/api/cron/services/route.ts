import { createSupabaseCatalogStore } from '@/server/catalog/supabase-catalog-store';
import { syncServices } from '@/server/catalog/sync-services';
import { assertCronSecret } from '@/server/http/cron-auth';
import { handler } from '@/server/http/handler';
import { getProvider } from '@/server/providers';
import { notifyOwner } from '@/server/providers/telegram';

// Synchro du catalogue (nouveaux services, prix, services disparus), appelée toutes les heures
// par le workflow GitHub Actions. Un saut de prix au-delà du seuil prévient le propriétaire.
export const GET = handler(async (req) => {
  assertCronSecret(req);
  return syncServices({
    provider: getProvider(),
    store: createSupabaseCatalogStore(),
    onPriceJump: (jump) =>
      notifyOwner('price_jump', {
        service_id: jump.serviceId,
        old_price_xaf_1000: jump.oldPriceXaf1000,
        new_price_xaf_1000: jump.newPriceXaf1000,
        change_pct: jump.changePct,
      }),
  });
});
