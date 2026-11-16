'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

type Props = {
  userId: string;
  status: string;
  discountPct: number | null;
  dailyLimitXaf: number;
};

// Blocage (motif obligatoire), déblocage, remise personnelle et plafond journalier.
// Jamais de solde ici : le serveur refuse tout autre champ.
export function UserSettingsForm({ userId, status, discountPct, dailyLimitXaf }: Props) {
  const t = useTranslations('admin');
  const { pending, feedback, run } = useAdminAction({
    error: t('common.error'),
    success: t('common.saved'),
  });
  const [reason, setReason] = useState('');
  const path = `/api/v1/admin/users/${userId}`;
  const blocked = status === 'blocked';

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const discount = String(form.get('discount') ?? '').trim();
    const limit = String(form.get('limit') ?? '').trim();
    void run(path, 'PATCH', {
      custom_discount_pct: discount === '' ? null : Number(discount),
      daily_spend_limit_xaf: Number(limit),
    });
  }

  function block(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(path, 'PATCH', { status: 'blocked', blocked_reason: reason });
  }

  return (
    <div className="flex flex-col gap-4">
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}

      <form onSubmit={saveSettings} className="flex flex-wrap items-end gap-3">
        <Field
          name="discount"
          label={t('user.discount')}
          type="number"
          min={0}
          max={50}
          step="any"
          defaultValue={discountPct ?? ''}
        />
        <Field
          name="limit"
          label={t('user.limit')}
          type="number"
          min={0}
          step={1}
          required
          defaultValue={dailyLimitXaf}
        />
        <Button type="submit" disabled={pending}>
          {t('user.saveSettings')}
        </Button>
      </form>

      {blocked ? (
        <div>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => void run(path, 'PATCH', { status: 'active' })}
          >
            {t('user.unblock')}
          </Button>
        </div>
      ) : (
        <form onSubmit={block} className="flex flex-wrap items-end gap-3">
          <Field
            label={t('user.blockReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            required
            className="min-w-64 flex-1"
          />
          <Button type="submit" variant="destructive" disabled={pending || reason.trim() === ''}>
            {t('user.blockSubmit')}
          </Button>
        </form>
      )}
    </div>
  );
}
