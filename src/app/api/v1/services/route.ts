import { buildPublicCatalog } from '@/server/catalog/present-catalog';
import { getUsdXafRate, listPublicServices } from '@/server/catalog/public-catalog';
import { handler } from '@/server/http/handler';
import { catalogQuerySchema } from '@/lib/schemas/catalog';

// Catalogue public : mis en cache 5 min (API_SPEC §6.4).
const CACHE = 'public, s-maxage=300';

export const GET = handler(async (req, ctx) => {
  const params = req.nextUrl.searchParams;
  const query = catalogQuerySchema.parse({
    currency: params.get('currency') ?? undefined,
    locale: params.get('locale') ?? undefined,
  });
  const [rows, usdXafRate] = await Promise.all([
    listPublicServices(),
    query.currency === 'USD' ? getUsdXafRate() : Promise.resolve(1),
  ]);
  const catalog = buildPublicCatalog(rows, {
    currency: query.currency,
    locale: query.locale ?? ctx.locale,
    usdXafRate,
  });
  return Response.json(catalog, {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': CACHE },
  });
});
