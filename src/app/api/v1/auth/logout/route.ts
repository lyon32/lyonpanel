import { createSessionClient } from '@/server/db/supabase-server';
import { handler } from '@/server/http/handler';
import { assertSameOrigin } from '@/server/http/request';

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  return new Response(null, { status: 204, headers: { 'x-request-id': ctx.requestId } });
});
