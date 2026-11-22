const DEFAULT_SITE_URL = 'https://lyonpanel.com';

type Env = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Adresse publique du site, sans slash final.
 * Lue à chaque appel (pas à l'import). Une valeur vide, invalide ou en http
 * (sauf localhost hors production) retombe sur l'adresse par défaut.
 */
export function getSiteUrl(env: Env = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return DEFAULT_SITE_URL;
  }
  const isProd = env.NODE_ENV === 'production';
  const httpOk = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname) && !isProd;
  if (url.protocol !== 'https:' && !httpOk) return DEFAULT_SITE_URL;
  return url.origin;
}
