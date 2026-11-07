import { routing, type Locale } from './routing';

function isLocale(value: string | undefined): value is Locale {
  return routing.locales.some((l) => l === value);
}

// Première langue gérée de l'en-tête, dans l'ordre de préférence (q décroissant).
function fromAcceptLanguage(header: string | undefined): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split('-')[0], q: Number.isNaN(q) ? 0 : q, index };
    })
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return ranked.map((r) => r.lang).find(isLocale);
}

// Cookie valide d'abord, puis Accept-Language, sinon français.
export function pickLocale(input: { cookie?: string; acceptLanguage?: string }): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage) ?? routing.defaultLocale;
}
