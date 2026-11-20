'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import {
  diffSettings,
  SETTING_FIELDS,
  type SettingFieldKey,
  type SettingInputs,
  type SettingsDiff,
  type SettingValues,
} from '@/lib/admin-settings-form';

// Réglages bornés : ancienne valeur affichée, récapitulatif puis confirmation avant l'envoi.
export function SettingsForm({ current }: { current: SettingValues }) {
  const t = useTranslations('admin');
  const { pending, feedback, run, clearFeedback } = useAdminAction({
    error: t('common.error'),
    success: t('settings.saved'),
  });
  const [inputs, setInputs] = useState<SettingInputs>(
    () =>
      Object.fromEntries(
        SETTING_FIELDS.map((f) => [f.key, String(current[f.key])]),
      ) as SettingInputs,
  );
  const [diff, setDiff] = useState<SettingsDiff | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function edit(key: SettingFieldKey, value: string) {
    setInputs((p) => ({ ...p, [key]: value }));
    setDiff(null);
    setConfirming(false);
    setNotice(null);
    clearFeedback();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (confirming && diff) {
      void send(diff);
      return;
    }
    const d = diffSettings(current, inputs);
    setDiff(d);
    if (d.invalid.length > 0) {
      setNotice(t('settings.invalid'));
    } else if (d.changes.length === 0) {
      setNotice(t('settings.nothing'));
    } else {
      setNotice(null);
      setConfirming(true);
    }
  }

  async function send(d: SettingsDiff) {
    await run('/api/v1/admin/settings', 'PATCH', d.patch);
    setConfirming(false);
    setDiff(null);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="border-gris-200 bg-blanc grid gap-4 rounded-xl border p-4 sm:grid-cols-2 sm:p-5">
        {SETTING_FIELDS.map((f) => (
          <Field
            key={f.key}
            name={f.key}
            type="text"
            inputMode="decimal"
            label={`${t(`settings.fields.${f.key}`)} (${f.unit})`}
            hint={`${t('settings.current')} : ${current[f.key]}`}
            value={inputs[f.key]}
            disabled={pending || confirming}
            error={diff?.invalid.includes(f.key) ? t('settings.fieldInvalid') : undefined}
            onChange={(e) => edit(f.key, e.target.value)}
          />
        ))}
      </div>
      {notice ? <FormAlert kind="error">{notice}</FormAlert> : null}
      {confirming && diff ? (
        <div role="alert" className="bg-jaune-50 text-encre rounded-lg p-3 text-sm">
          <p className="font-semibold">{t('settings.recap')}</p>
          <ul className="mt-1 flex flex-col gap-1 tabular-nums">
            {diff.changes.map((c) => (
              <li key={c.key}>
                {t(`settings.fields.${c.key}`)} : {c.oldValue} → {c.newValue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          className="w-full sm:w-fit"
          loading={pending}
          loadingLabel={t('orders.sending')}
          disabled={pending}
        >
          {confirming ? t('settings.confirm') : t('settings.submit')}
        </Button>
        {confirming && !pending ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-fit"
            onClick={() => setConfirming(false)}
          >
            {t('orders.cancelAction')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
