'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';

// États vide, chargement et erreur ; « Réessayer » ne fait rien dans la démo.
export function DemoStates() {
  const t = useTranslations('demo');
  const tc = useTranslations('common');
  return (
    <div data-testid="demo-states" className="grid gap-6 md:grid-cols-3">
      <div data-testid="demo-state-empty">
        <EmptyState title={t('emptyTitle')} description={t('emptyText')} />
      </div>
      <LoadingState label={tc('loading')} />
      <ErrorState
        title={t('errorTitle')}
        description={t('errorText')}
        retryLabel={tc('retry')}
        onRetry={() => undefined}
      />
    </div>
  );
}
