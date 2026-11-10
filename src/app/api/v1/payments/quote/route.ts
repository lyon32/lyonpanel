import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { quotePayment } from '@/server/payments/quote';
import { quotePaymentSchema } from '@/server/schemas/payment';

// Devis d'une recharge : frais et total calculés ici, jamais lus dans la requête.
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  await requireApiUser();
  const { amount_xaf } = await parseBody(req, quotePaymentSchema);
  const quote = await quotePayment(amount_xaf);
  return { amount_xaf: quote.amountXaf, fee_xaf: quote.feeXaf, total_to_pay: quote.totalToPay };
});
