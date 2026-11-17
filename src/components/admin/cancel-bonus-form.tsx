'use client';

import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
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
      <Button variant="secondary" className="w-full sm:w-fit" onClick={() => setOpen(true)}>
        {t('user.cancelBonus')}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-erreur bg-erreur-fond flex flex-col gap-3 rounded-xl border-2 p-4"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="text-erreur mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-erreur font-bold">{t('user.cancelWarningTitle')}</p>
          <p className="text-encre text-sm">{t('user.cancelWarning')}</p>
        </div>
      </div>
      <Field
        label={t('user.cancelReason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
      />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-bleu-600 focus-visible:ring-bleu-100 mt-0.5 size-6 shrink-0 outline-none focus-visible:ring-4"
        />
        <span>{t('user.cancelConfirm')}</span>
      </label>
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div>
        <Button
          type="submit"
          variant="destructive"
          className="w-full sm:w-fit"
          loading={pending}
          loadingLabel={t('common.loading')}
          disabled={pending || !confirmed || reason.trim() === ''}
        >
          {t('user.cancelSubmit')}
        </Button>
      </div>
    </form>
  );
}
