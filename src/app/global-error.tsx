'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Dernier filet : erreur dans le layout racine. Hors next-intl (le layout est cassé),
// le texte reste donc bilingue et neutre.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <p>Une erreur est survenue. / Something went wrong.</p>
      </body>
    </html>
  );
}
