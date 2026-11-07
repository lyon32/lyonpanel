import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Pas de Session Replay : il pourrait filmer des données personnelles.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  // SDK 11 : sendDefaultPii n'existe plus, dataCollection le remplace (aucune donnée perso)
  dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false },
  tracesSampleRate: 0.1,
  // 'static' garde beforeSendTransaction actif (le mode flux l'ignorerait)
  traceLifecycle: 'static',
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
