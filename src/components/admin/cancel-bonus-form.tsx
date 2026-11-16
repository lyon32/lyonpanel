'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

// Annulation d'un bonus de parrainage : motif obligatoire ET case de confirmation explicite,
// car le solde du parrain peut devenir négatif.
export function CancelBonusForm({ rewardId }: { rewardId: string }) {
  const t = useTranslations('admin');
  const { pending, feedback, run } = useAdminAction({
    error: t('common.error'),
    success: t('common.saved'),
  });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    void run(`/api/v1/admin/referrals/${rewardId}/cancel`, 'POST', { reason });
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('user.cancelBonus')}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <FormAlert kind="error">{t('user.cancelWarning')}</FormAlert>
      <Field
        label={t('user.cancelReason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>{t('user.cancelConfirm')}</span>
      </label>
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || !confirmed || reason.trim() === ''}
        >
          {t('user.cancelSubmit')}
        </Button>
      </div>
    </form>
  );
}
