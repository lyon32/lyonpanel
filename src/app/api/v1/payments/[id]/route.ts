import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/server/auth/require-api-user';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le site rappelle cette route toutes les 5 s sur la page de retour (API_SPEC §6.6).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (_request, ctx) => {
    const user = await requireApiUser();
    // Identifiant illisible ou recharge d'un autre client : même réponse 404, rien n'est révélé.
    if (!UUID.test(id)) apiError('PAYMENT_NOT_FOUND');
    const supabase = await createSessionClient();
    const { data } = await supabase
      .from('payments')
      .select('id, credited_xaf, fee_xaf, status, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) apiError('PAYMENT_NOT_FOUND');
    return Response.json(
      {
        id: data.id,
        amount_xaf: data.credited_xaf,
        fee_xaf: data.fee_xaf,
        status: data.status,
        created_at: data.created_at,
      },
      { headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' } },
    );
  })(req);
}
