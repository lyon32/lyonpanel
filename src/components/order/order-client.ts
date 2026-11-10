// Appels navigateur vers /api/v1/orders. Renvoient toujours un résultat, jamais d'exception.
// Aucun prix n'est calculé ici : on affiche les chiffres du serveur.
export type OrderQuote = {
  priceXaf1000: number;
  discountPct: number;
  totalXaf: number;
  balanceAfterXaf: number;
};

export type OrderOutcome = {
  status: 'in_progress' | 'to_review';
  shortId: number;
  chargedXaf: number;
};

export type Failure = { code: string; message: string; details: Record<string, unknown> };

type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };

const NETWORK_FAILURE: Failure = { code: 'NETWORK', message: '', details: {} };

async function post(
  path: string,
  body: Record<string, unknown>,
  locale: string,
  extra: Record<string, string> = {},
): Promise<{ ok: boolean; data: Record<string, unknown> } | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': locale, ...extra },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    const record =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    return { ok: response.ok, data: record };
  } catch {
    return null;
  }
}

function failureOf(data: Record<string, unknown>): Failure {
  const error = data.error;
  if (typeof error !== 'object' || error === null) return { ...NETWORK_FAILURE, code: 'UNKNOWN' };
  const { code, message, details } = error as Record<string, unknown>;
  return {
    code: typeof code === 'string' ? code : 'UNKNOWN',
    message: typeof message === 'string' ? message : '',
    details:
      typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : {},
  };
}

export async function fetchOrderQuote(
  serviceId: number,
  quantity: number,
  locale: string,
): Promise<Result<OrderQuote>> {
  const res = await post('/api/v1/orders/quote', { service_id: serviceId, quantity }, locale);
  if (!res) return { ok: false, error: NETWORK_FAILURE };
  const d = res.data;
  if (
    res.ok &&
    typeof d.price_xaf_1000 === 'number' &&
    typeof d.discount_pct === 'number' &&
    typeof d.total_xaf === 'number' &&
    typeof d.balance_after_xaf === 'number'
  ) {
    return {
      ok: true,
      value: {
        priceXaf1000: d.price_xaf_1000,
        discountPct: d.discount_pct,
        totalXaf: d.total_xaf,
        balanceAfterXaf: d.balance_after_xaf,
      },
    };
  }
  return { ok: false, error: failureOf(d) };
}

export type PlaceOrderInput = {
  serviceId: number;
  link: string;
  quantity: number;
  comments?: string[];
  expectedTotalXaf: number;
};

// La clé d'idempotence est fournie par l'appelant : même clé pour la même tentative.
export async function placeOrderRequest(
  input: PlaceOrderInput,
  locale: string,
  idempotencyKey: string,
): Promise<Result<OrderOutcome>> {
  const res = await post(
    '/api/v1/orders',
    {
      service_id: input.serviceId,
      link: input.link,
      quantity: input.quantity,
      ...(input.comments ? { comments: input.comments } : {}),
      expected_total_xaf: input.expectedTotalXaf,
    },
    locale,
    { 'Idempotency-Key': idempotencyKey },
  );
  if (!res) return { ok: false, error: NETWORK_FAILURE };
  const { status, short_id: shortId } = res.data;
  if (res.ok && typeof shortId === 'number') {
    const outcome = status === 'to_review' ? 'to_review' : 'in_progress';
    const charged = typeof res.data.charged_xaf === 'number' ? res.data.charged_xaf : 0;
    return { ok: true, value: { status: outcome, shortId, chargedXaf: charged } };
  }
  return { ok: false, error: failureOf(res.data) };
}
