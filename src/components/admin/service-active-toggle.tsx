'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';

// Activer ou masquer un service en un geste, avec une confirmation courte.
export function ServiceActiveToggle({ serviceId, active }: { serviceId: number; active: boolean }) {
  const t = useTranslations('admin');
  const { pending, feedback, run } = useAdminAction({
    error: t('common.error'),
    success: t('common.saved'),
  });
  const [confirming, setConfirming] = useState(false);

  async function confirm() {
    await run(`/api/v1/admin/services/${serviceId}`, 'PATCH', { active: !active });
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"

          variant={confirming && active ? 'destructive' : 'secondary'}
          loading={pending}
          loadingLabel={t('orders.sending')}
          disabled={pending}
          onClick={() => (confirming ? void confirm() : setConfirming(true))}
        >
          {confirming
            ? t('services.confirmToggle')
            : active
              ? t('services.hide')
              : t('services.activate')}
        </Button>
        {confirming && !pending ? (
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
            {t('orders.cancelAction')}
          </Button>
        ) : null}
      </div>
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
    </div>
  );
}
