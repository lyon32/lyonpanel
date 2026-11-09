// En-têtes de sécurité envoyés avec chaque page. Module pur (aucun import de Next) pour être testable.
export type SecurityHeader = { key: string; value: string };

type Options = {
  isProd: boolean;
  supabaseUrl: string;
  sentryDsn?: string;
};

const TURNSTILE = 'https://challenges.cloudflare.com';

/** Origine seule (schéma + hôte + port) d'une adresse ; chaîne vide si ce n'est pas une adresse. */
function originOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function buildSecurityHeaders({
  isProd,
  supabaseUrl,
  sentryDsn,
}: Options): SecurityHeader[] {
  const supabase = originOf(supabaseUrl);
  const sentry = originOf(sentryDsn);

  // 'unsafe-inline' pour les scripts : Next injecte de petits scripts en ligne (hydratation, next-intl)
  // dont le contenu change à chaque page, donc impossible à lister ; un nonce rendrait toutes les pages
  // dynamiques. Le reste de la politique (origines fermées, pas d'eval, pas d'objets) limite les dégâts.
  // En développement seulement, React a besoin d'eval pour ses outils de débogage.
  const scriptSrc = ["'self'", "'unsafe-inline'", TURNSTILE, ...(isProd ? [] : ["'unsafe-eval'"])];
  // En développement, le rechargement à chaud passe par une WebSocket locale.
  const connectSrc = ["'self'", supabase, sentry, ...(isProd ? [] : ['ws://localhost:*'])];

  const csp = [
    ['default-src', "'self'"],
    ['script-src', ...scriptSrc],
    // Next et les polices du design system posent des styles en ligne.
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:', 'blob:'],
    ['font-src', "'self'", 'data:'],
    ['connect-src', ...connectSrc.filter(Boolean)],
    ['frame-src', TURNSTILE],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
  ]
    .map((parts) => parts.join(' '))
    .join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Doublon de frame-ancestors pour les vieux navigateurs.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    // HSTS seulement en production : en local (http), il enfermerait le navigateur sur https.
    ...(isProd
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
      : []),
  ];
}
