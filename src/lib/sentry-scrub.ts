// Retire les données personnelles d'un événement Sentry avant envoi
// (SECURITY_NOTES.md §7) : email, téléphone, IP, cookies, en-têtes sensibles, corps.
export type SentryLikeEvent = {
  user?: Record<string, unknown>;
  request?: {
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
  };
  message?: string;
};

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Numéro international : + puis 8 à 15 chiffres (espaces tolérés).
const PHONE = /\+\d[\d ]{7,17}\d/g;
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  const out: T = { ...event };

  if (event.user) {
    const user = { ...event.user };
    delete user.email;
    delete user.ip_address;
    delete user.phone;
    out.user = user;
  }

  if (event.request) {
    const request = { ...event.request };
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(([k]) => !SENSITIVE_HEADERS.has(k.toLowerCase())),
      );
    }
    delete request.cookies;
    delete request.data;
    out.request = request;
  }

  if (typeof event.message === 'string') {
    out.message = event.message.replace(EMAIL, '[email]').replace(PHONE, '[téléphone]');
  }

  return out;
}
