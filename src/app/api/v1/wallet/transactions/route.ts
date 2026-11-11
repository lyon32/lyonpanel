import { z } from 'zod';
import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { listTransactions, TX_TYPES } from '@/server/wallet/list-transactions';

const querySchema = z.object({
  type: z.enum(TX_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});

export const GET = handler(async (req, ctx) => {
  const user = await requireApiUser();
  const search = req.nextUrl.searchParams;
  const query = querySchema.parse({
    type: search.get('type') ?? undefined,
    limit: search.get('limit') ?? undefined,
    cursor: search.get('cursor') ?? undefined,
  });
  return Response.json(await listTransactions(user.id, query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
