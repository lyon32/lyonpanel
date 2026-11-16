import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { isAdminSegment } from '@/server/auth/admin-path';

const intl = createMiddleware(routing);

// Next 16 : « proxy » remplace « middleware ». Gère le préfixe de langue et le cookie NEXT_LOCALE.
// L'adresse secrète de l'admin est réécrite vers /gestion/<secret> (sans préfixe de langue) ;
// toute autre adresse suit le chemin normal, donc /admin tombe sur le 404 du site.
export default function proxy(req: NextRequest) {
  const segment = req.nextUrl.pathname.split('/')[1];
  if (isAdminSegment(segment, process.env.ADMIN_PATH)) {
    const url = req.nextUrl.clone();
    url.pathname = `/gestion${req.nextUrl.pathname}`;
    const response = NextResponse.rewrite(url);
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  return intl(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\..*).*)'],
};
