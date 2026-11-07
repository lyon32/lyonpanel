import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {};

// Pas de jeton ici : le téléversement des source maps (SENTRY_AUTH_TOKEN) viendra avec la mise en ligne.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
