import { assertTestRouteAllowed } from '../guard';
import { handler } from '@/server/http/handler';
import { armNextAddFailure } from '@/server/providers/mock-provider';

// Route réservée aux tests e2e : le prochain `add` du faux fournisseur échoue, une seule fois.
export const POST = handler(async (req) => {
  assertTestRouteAllowed(req);
  armNextAddFailure();
  return { armed: true };
});
