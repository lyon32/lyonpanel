import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Erreurs + traces seulement ; désactivé sans DSN (tests, CI).
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? 'development',
  // SDK 11 : sendDefaultPii n'existe plus, dataCollection le remplace (aucune donnée perso)
  dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0.1,
  // 'static' garde beforeSendTransaction actif (le mode flux l'ignorerait)
  traceLifecycle: 'static',
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
