import { assertCronSecret } from '@/server/http/cron-auth';
import { handler } from '@/server/http/handler';
import { recordProviderBalance } from '@/server/providers/record-provider-balance';

// Relevé du solde fournisseur, appelé toutes les heures par le workflow GitHub Actions.
export const GET = handler(async (req) => {
  assertCronSecret(req);
  const { alerted } = await recordProviderBalance();
  // Le solde lui-même n'est pas renvoyé : cette route ne sert qu'au planificateur.
  return { recorded: true, alerted };
});
