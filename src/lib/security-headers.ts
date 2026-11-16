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
    // Captures des tickets : URL signées du stockage du projet Supabase (origine précise, jamais https:).
    ['img-src', ...["'self'", 'data:', 'blob:', supabase].filter(Boolean)],
    // La compression des images (browser-image-compression) lance un Web Worker depuis une URL blob:.
    ['worker-src', "'self'"],
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

// Zone privée : adresses (FR puis EN) des pages réservées aux clients connectés.
// Doit rester alignée sur src/i18n/routing.ts (un test unitaire le vérifie).
export const PRIVATE_PATHS: readonly (readonly [string, string])[] = [
  ['/tableau-de-bord', '/dashboard'],
  ['/commander', '/order'],
  ['/commandes', '/orders'],
  ['/recharger', '/add-funds'],
  ['/transactions', '/transactions'],
  ['/favoris', '/favorites'],
  ['/support', '/support'],
  ['/parrainage', '/referral'],
  ['/compte', '/account'],
];

/**
 * Règles `headers()` pour la zone privée : `no-store` empêche le navigateur de garder la page
 * (bouton Retour après déconnexion) ; il doit alors la redemander, et le serveur renvoie vers la connexion.
 */
export function buildPrivateCacheRules(): { source: string; headers: SecurityHeader[] }[] {
  const headers = [
    { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
  ];
  return (['fr', 'en'] as const).flatMap((locale, index) =>
    PRIVATE_PATHS.map((paths) => ({ source: `/${locale}${paths[index]}`, headers })),
  );
}
