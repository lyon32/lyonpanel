import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { handleSaspayWebhook } from '@/server/payments/handle-webhook';

// Webhook SasPay : pas de contrôle d'Origin (appel de serveur à serveur), la signature fait foi.
export const POST = handler(async (req) => {
  // Corps BRUT : la signature se calcule sur les octets reçus, pas sur un JSON reformaté.
  const rawBody = await req.text();
  const result = await handleSaspayWebhook(rawBody, req.headers);
  // 403 attendu par SasPay si signature ou horodatage invalide ; 200 pour tout le reste (pas de renvoi inutile).
  if (result === 'rejected') apiError('FORBIDDEN');
  return { received: true };
});
