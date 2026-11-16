// Appels JSON vers l'API admin depuis le navigateur. Ne lève jamais : renvoie le statut et le corps.
export type AdminResponse = { ok: boolean; status: number; data: unknown };

export async function adminFetch(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  body?: Record<string, unknown>,
): Promise<AdminResponse> {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: unknown = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export type MfaStatus = { verified: number; needsMoreDevices: boolean; aal2: boolean };

export function asMfaStatus(data: unknown): MfaStatus | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.verified !== 'number') return null;
  return {
    verified: d.verified,
    needsMoreDevices: d.needsMoreDevices === true,
    aal2: d.aal2 === true,
  };
}

/** Message d'erreur renvoyé par l'API (format API_SPEC §3), ou null si absent. */
export function apiErrorMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const error = (data as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' ? message : null;
}
