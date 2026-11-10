import type { NextRequest } from 'next/server';
import { toPublicService } from '@/server/catalog/present-catalog';
import { getPublicService, getUsdXafRate } from '@/server/catalog/public-catalog';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { catalogQuerySchema } from '@/lib/schemas/catalog';

const CACHE = 'public, s-maxage=300';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  return handler(async (request, ctx) => {
    // Un identifiant illisible est traité comme inconnu : même réponse, rien à deviner.
    if (!/^[1-9]\d{0,9}$/.test(rawId)) apiError('NOT_FOUND');
    const search = request.nextUrl.searchParams;
    const query = catalogQuerySchema.parse({
      currency: search.get('currency') ?? undefined,
      locale: search.get('locale') ?? undefined,
    });
    const row = await getPublicService(Number(rawId));
    if (!row) apiError('NOT_FOUND');
    const usdXafRate = query.currency === 'USD' ? await getUsdXafRate() : 1;
    const service = toPublicService(row, {
      currency: query.currency,
      locale: query.locale ?? ctx.locale,
      usdXafRate,
    });
    return Response.json(service, {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': CACHE },
    });
  })(req);
}
