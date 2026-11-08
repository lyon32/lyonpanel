import 'server-only';

/** '+237600000012' devient '+2376****12' : début et 2 derniers chiffres seulement. */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return '****';
  return `${phone.slice(0, 5)}****${phone.slice(-2)}`;
}

/** 'jean@gmail.com' devient 'j***@gmail.com'. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

const SECRET_KEYS = new Set([
  'password',
  'new_password',
  'turnstile_token',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
]);

/** Copie profonde où les secrets sont remplacés ; l'objet d'origine reste intact. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        SECRET_KEYS.has(key.toLowerCase()) ? '[masqué]' : redactSecrets(v),
      ]),
    );
  }
  return value;
}
