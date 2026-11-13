import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { createTicketSchema, listTicketsQuerySchema } from '@/server/schemas/ticket';
import { createTicket, listTickets } from '@/server/tickets/tickets';

const PRIVATE = 'private, no-store';

export const GET = handler(async (req, ctx) => {
  const user = await requireApiUser();
  const search = req.nextUrl.searchParams;
  const query = listTicketsQuerySchema.parse({
    cursor: search.get('cursor') ?? undefined,
    limit: search.get('limit') ?? undefined,
  });
  return Response.json(await listTickets(user.id, query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': PRIVATE },
  });
});

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const input = await parseBody(req, createTicketSchema);
  return Response.json(await createTicket(user.id, input), {
    status: 201,
    headers: { 'x-request-id': ctx.requestId, 'cache-control': PRIVATE },
  });
});
