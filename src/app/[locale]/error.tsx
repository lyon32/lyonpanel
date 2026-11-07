'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/shared/error-state';

// On n'affiche jamais error.message : il peut contenir des détails techniques.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('error');
  return (
    <main className="px-4 py-16">
      <ErrorState
        title={t('title')}
        description={t('description')}
        retryLabel={t('retry')}
        onRetry={reset}
      />
    </main>
  );
}
