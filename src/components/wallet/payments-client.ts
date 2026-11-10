// Appels navigateur vers /api/v1/payments. Renvoient toujours un résultat, jamais d'exception.
export type Quote = { amountXaf: number; feeXaf: number; totalToPay: number };
export type Failure = { message: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };

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
  const message =
    typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : null;
  return { message: typeof message === 'string' ? message : '' };
}

// Le serveur calcule frais et total : on affiche ses chiffres tels quels.
export async function fetchQuote(amountXaf: number, locale: string): Promise<Result<Quote>> {
  const res = await post('/api/v1/payments/quote', { amount_xaf: amountXaf }, locale);
  if (!res) return { ok: false, error: { message: '' } };
  const { amount_xaf: amount, fee_xaf: fee, total_to_pay: total } = res.data;
  if (
    res.ok &&
    typeof amount === 'number' &&
    typeof fee === 'number' &&
    typeof total === 'number'
  ) {
    return { ok: true, value: { amountXaf: amount, feeXaf: fee, totalToPay: total } };
  }
  return { ok: false, error: failureOf(res.data) };
}

// La clé d'idempotence est tirée une fois par clic : un double clic ne crée pas deux paiements.
export async function startPayment(
  amountXaf: number,
  locale: string,
  idempotencyKey: string,
): Promise<Result<string>> {
  const res = await post('/api/v1/payments', { amount_xaf: amountXaf }, locale, {
    'Idempotency-Key': idempotencyKey,
  });
  if (!res) return { ok: false, error: { message: '' } };
  const url = res.data.checkout_url;
  if (res.ok && typeof url === 'string') return { ok: true, value: url };
  return { ok: false, error: failureOf(res.data) };
}
