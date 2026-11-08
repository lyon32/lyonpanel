// Appel JSON vers l'API d'authentification, côté navigateur.
// Renvoie toujours un résultat (jamais d'exception) : le formulaire affiche le message du serveur.
export type ApiFailure = {
  code: string;
  message: string;
  fields: Record<string, string>;
};

export type AuthResult = { ok: true } | { ok: false; error: ApiFailure | null };

export async function postAuth(
  path: string,
  body: Record<string, unknown> | null,
  locale: string,
): Promise<AuthResult> {
  try {
    const response = await fetch(`/api/v1/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': locale },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.ok) return { ok: true };
    const data: unknown = await response.json().catch(() => null);
    return { ok: false, error: parseFailure(data) };
  } catch {
    // Réseau coupé : pas de réponse du serveur.
    return { ok: false, error: null };
  }
}

function parseFailure(data: unknown): ApiFailure | null {
  if (typeof data !== 'object' || data === null || !('error' in data)) return null;
  const error = (data as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const { code, message, details } = error as {
    code?: unknown;
    message?: unknown;
    details?: { fields?: unknown };
  };
  const rawFields = details?.fields;
  const fields: Record<string, string> = {};
  if (typeof rawFields === 'object' && rawFields !== null) {
    for (const [name, value] of Object.entries(rawFields)) {
      if (typeof value === 'string') fields[name] = value;
    }
  }
  return {
    code: typeof code === 'string' ? code : 'INTERNAL_ERROR',
    message: typeof message === 'string' ? message : '',
    fields,
  };
}
