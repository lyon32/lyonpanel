// Retire les données personnelles d'un événement Sentry avant envoi
// (SECURITY_NOTES.md §7). Approche : liste blanche pour ce qu'on connaît
// (user, en-têtes, URL), masquage par regex pour toutes les chaînes du reste.
export type SentryLikeEvent = {
  user?: Record<string, unknown>;
  request?: {
    url?: string;
    query_string?: unknown;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
  };
  message?: string;
};

// Email, y compris sans point dans le domaine (jean@localhost).
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*/g;
// Téléphone : au moins 8 chiffres, sans plafond (aucun fragment ne doit rester).
const PHONE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/g;
// En-têtes conservés (tout le reste est retiré : clés d'API, IP, referer…).
const ALLOWED_HEADERS = new Set(['user-agent', 'content-type', 'accept', 'accept-language']);

function maskString(value: string): string {
  return value.replace(EMAIL, '[email]').replace(PHONE, '[téléphone]');
}

// Parcourt récursivement sans muter l'entrée.
function maskDeep(value: unknown): unknown {
  if (typeof value === 'string') return maskString(value);
  if (Array.isArray(value)) return value.map(maskDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v)]));
  }
  return value;
}

// Identifiants et métadonnées techniques : jamais masqués, sinon Sentry
// rejette l'événement (une suite de chiffres d'un trace_id ressemblerait à un téléphone).
const SAFE_TOP_KEYS = [
  'event_id',
  'release',
  'sdk',
  'platform',
  'environment',
  'level',
  'type',
  'timestamp',
  'start_timestamp',
  'transaction_info',
];
const SAFE_SPAN_KEYS = ['trace_id', 'span_id', 'parent_span_id', 'start_timestamp', 'timestamp'];

type Loose = Record<string, unknown>;

function restoreTechnicalFields(source: Loose, out: Loose): void {
  for (const key of SAFE_TOP_KEYS) {
    if (key in source) out[key] = source[key];
  }
  const srcTrace = (source.contexts as Loose | undefined)?.trace;
  if (srcTrace !== undefined && out.contexts && typeof out.contexts === 'object') {
    (out.contexts as Loose).trace = srcTrace;
  }
  if (Array.isArray(source.spans) && Array.isArray(out.spans)) {
    source.spans.forEach((span: Loose, i: number) => {
      const target = (out.spans as Loose[])[i];
      if (!target) return;
      for (const key of SAFE_SPAN_KEYS) {
        if (key in span) target[key] = span[key];
      }
    });
  }
}

export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  const out = maskDeep(event) as SentryLikeEvent;
  restoreTechnicalFields(event as Loose, out as Loose);

  if (event.user) {
    // Seul l'identifiant interne est conservé (pas masqué par regex).
    out.user = event.user.id === undefined ? {} : { id: event.user.id };
  }

  if (event.request && out.request) {
    const request = out.request;
    if (event.request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(maskDeep(event.request.headers) as Record<string, string>).filter(([k]) =>
          ALLOWED_HEADERS.has(k.toLowerCase()),
        ),
      );
    }
    if (typeof event.request.url === 'string') {
      // La query peut contenir email, jeton… : on la retire entièrement.
      request.url = maskString(event.request.url.split('#')[0]!.split('?')[0]!);
    }
    delete request.query_string;
    delete request.cookies;
    delete request.data;
  }

  return out as T;
}
