import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import createNextIntlPlugin from 'next-intl/plugin';

import { buildSecurityHeaders } from './src/lib/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders({
          isProd: process.env.NODE_ENV === 'production',
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        }),
      },
    ];
  },
  // La liste des mots de passe courants est lue à l'exécution : Vercel doit l'embarquer avec les routes d'authentification.
  outputFileTracingIncludes: {
    '/api/v1/auth/**': ['./data/common-passwords.txt'],
  },
};

// Pas de jeton ici : le téléversement des source maps (SENTRY_AUTH_TOKEN) viendra avec la mise en ligne.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  telemetry: false,
});
