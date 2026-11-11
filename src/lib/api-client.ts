// Appels JSON vers /api/v1 depuis le navigateur. Renvoient toujours un résultat, jamais d'exception.
export type ApiResult<T> =
  | { ok: true; data: T }
  // fields : erreurs par champ (API_SPEC §3, details.fields), ex. { phone: 'PHONE_TAKEN' }.
  | { ok: false; code: string; message: string; fields: Record<string, string> };

export async function callApi<T = null>(
  method: 'GET' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body: Record<string, unknown> | null,
  locale: string,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept-Language': locale },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: data as T };
    const error =
      typeof data === 'object' && data !== null && 'error' in data
        ? (data as { error: { code?: unknown; message?: unknown; details?: unknown } }).error
        : null;
    const rawFields = (error?.details as { fields?: unknown } | undefined)?.fields;
    const fields: Record<string, string> = {};
    if (typeof rawFields === 'object' && rawFields !== null) {
      for (const [key, value] of Object.entries(rawFields)) {
        if (typeof value === 'string') fields[key] = value;
      }
    }
    return {
      ok: false,
      code: typeof error?.code === 'string' ? error.code : 'UNKNOWN',
      message: typeof error?.message === 'string' ? error.message : '',
      fields,
    };
  } catch {
    return { ok: false, code: 'NETWORK', message: '', fields: {} };
  }
}
