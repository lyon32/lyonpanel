import { requireApiUser } from '@/server/auth/require-api-user';
import { createAttemptStore, createRateLimiter } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { createPayment } from '@/server/payments/create-payment';
import {
  createPaymentSchema,
  idempotencyKeySchema,
  listPaymentsQuerySchema,
} from '@/server/schemas/payment';

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  // API_SPEC §5 : 5 créations / minute / client, avant tout appel à SasPay.
  await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
    scope: 'payments',
    key: user.id,
    max: 5,
    windowSeconds: 60,
  });
  // Absent -> VALIDATION_ERROR (Zod), comme tout champ obligatoire.
  const idempotencyKey = idempotencyKeySchema.parse(
    req.headers.get('idempotency-key') ?? undefined,
  );
  const { amount_xaf } = await parseBody(req, createPaymentSchema);
  const { id, checkoutUrl } = await createPayment(user.id, amount_xaf, idempotencyKey);
  return Response.json(
    { id, status: 'pending', checkout_url: checkoutUrl },
    { status: 201, headers: { 'x-request-id': ctx.requestId } },
  );
});

type PaymentListRow = {
  id: string;
  credited_xaf: number;
  fee_xaf: number;
  status: string;
  created_at: string;
};

// Seules ces colonnes sortent : jamais de session SasPay, de transaction ni de charge de webhook.
export const GET = handler(async (req, ctx) => {
  const user = await requireApiUser();
  const search = req.nextUrl.searchParams;
  const { limit, cursor } = listPaymentsQuerySchema.parse({
    limit: search.get('limit') ?? undefined,
    cursor: search.get('cursor') ?? undefined,
  });
  // Client de session : la RLS limite déjà aux recharges du client, le filtre user_id double la garde.
  const supabase = await createSessionClient();
  let query = supabase
    .from('payments')
    .select('id, credited_xaf, fee_xaf, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1);
  if (cursor) query = query.lt('created_at', cursor);
  const { data, error } = await query;
  if (error) throw new Error(`liste des recharges: ${error.message}`);
  const rows = data as PaymentListRow[];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return Response.json(
    {
      data: page.map((p) => ({
        id: p.id,
        amount_xaf: p.credited_xaf,
        fee_xaf: p.fee_xaf,
        status: p.status,
        created_at: p.created_at,
      })),
      next_cursor: rows.length > limit && last ? last.created_at : null,
    },
    { headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' } },
  );
});
