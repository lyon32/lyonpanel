import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

// Next 16 : « proxy » remplace « middleware ». Gère le préfixe de langue et le cookie NEXT_LOCALE.
export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
