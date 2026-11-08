import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {};

// Pas de jeton ici : le téléversement des source maps (SENTRY_AUTH_TOKEN) viendra avec la mise en ligne.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  telemetry: false,
});
