'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { adminFetch, apiErrorMessage } from './admin-api';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { formatXaf } from '@/lib/admin-format';

export type ServiceEditData = {
  id: number;
  nameFr: string;
  nameEn: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  customNameFr: string | null;
  customNameEn: string | null;
  customDescriptionFr: string | null;
  customDescriptionEn: string | null;
  multiplier: number;
  sortOrder: number;
};

type Preview = { multiplier: number; oldXaf: number; newXaf: number };

// Même borne que le serveur (texte client personnalisé).
const MAX_TEXT = 400;

function asPreview(data: unknown, multiplier: number): Preview | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.old_price_xaf_1000 !== 'number' || typeof d.new_price_xaf_1000 !== 'number') {
    return null;
  }
  return { multiplier, oldXaf: d.old_price_xaf_1000, newXaf: d.new_price_xaf_1000 };
}

// Fiche d'édition : le nouveau prix vient toujours de la route d'aperçu, jamais du navigateur.
export function ServiceEditForm({ service, locale }: { service: ServiceEditData; locale: string }) {
  const t = useTranslations('admin');
  const { pending, feedback, run, clearFeedback } = useAdminAction({
    error: t('common.error'),
    success: t('common.saved'),
  });
  const [customNameFr, setCustomNameFr] = useState(service.customNameFr ?? '');
  const [customNameEn, setCustomNameEn] = useState(service.customNameEn ?? '');
  const [descFr, setDescFr] = useState(service.customDescriptionFr ?? '');
  const [descEn, setDescEn] = useState(service.customDescriptionEn ?? '');
  const [multiplier, setMultiplier] = useState(String(service.multiplier));
  const [sortOrder, setSortOrder] = useState(String(service.sortOrder));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const multiplierValue = Number(multiplier.replace(',', '.'));
  const multiplierValid =
    Number.isFinite(multiplierValue) && multiplierValue > 0 && multiplierValue <= 50;
  const multiplierChanged = multiplierValid && multiplierValue !== service.multiplier;
  const sortValue = Number(sortOrder);
  const sortValid = Number.isInteger(sortValue) && Math.abs(sortValue) <= 1_000_000;

  function touched() {
    setConfirming(false);
    setNotice(null);
    clearFeedback();
  }

  async function loadPreview(): Promise<Preview | null> {
    if (!multiplierValid) {
      setNotice(t('services.multiplierInvalid'));
      return null;
    }
    setPreviewing(true);
    const res = await adminFetch(`/api/v1/admin/services/${service.id}/preview`, 'POST', {
      multiplier: multiplierValue,
    });
    setPreviewing(false);
    const p = res.ok ? asPreview(res.data, multiplierValue) : null;
    if (!p) setNotice(apiErrorMessage(res.data) ?? t('common.error'));
    setPreview(p);
    return p;
  }

  // Seuls les champs modifiés partent ; un champ texte vidé revient au texte généré.
  function buildChanges(): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    const text = (key: string, value: string, initial: string | null) => {
      if (value.trim() !== (initial ?? '')) changes[key] = value.trim();
    };
    text('custom_name_fr', customNameFr, service.customNameFr);
    text('custom_name_en', customNameEn, service.customNameEn);
    text('custom_description_fr', descFr, service.customDescriptionFr);
    text('custom_description_en', descEn, service.customDescriptionEn);
    if (multiplierChanged) changes.multiplier = multiplierValue;
    if (sortValid && sortValue !== service.sortOrder) changes.sort_order = sortValue;
    return changes;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || previewing) return;
    if (!multiplierValid || !sortValid) {
      setNotice(t(!multiplierValid ? 'services.multiplierInvalid' : 'services.sortInvalid'));
      return;
    }
    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      setNotice(t('services.nothing'));
      return;
    }
    if (!confirming) {
      // Une nouvelle marge : on montre l'ancien et le nouveau prix avant de demander la confirmation.
      if (multiplierChanged && preview?.multiplier !== multiplierValue && !(await loadPreview())) {
        return;
      }
      setNotice(null);
      setConfirming(true);
      return;
    }
    const body = multiplierChanged ? { ...changes, confirm: true } : changes;
    const res = await run(`/api/v1/admin/services/${service.id}`, 'PATCH', body);
    if (res.ok) setPreview(null);
    setConfirming(false);
  }

  const shownPreview =
    preview && multiplierValid && preview.multiplier === multiplierValue ? preview : null;
  const locked = pending || previewing || confirming;

  const textArea = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    generated: string | null,
  ) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-encre text-sm font-semibold">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        maxLength={MAX_TEXT}
        disabled={locked}
        onChange={(e) => {
          set(e.target.value);
          touched();
        }}
      />
      <p className="text-gris-600 text-sm tabular-nums">
        {value.length} / {MAX_TEXT}
      </p>
      {value.trim() === '' ? (
        <p className="text-gris-600 bg-gris-50 rounded-lg p-3 text-sm">
          <span className="font-semibold">{t('services.generated')} : </span>
          {generated ?? t('common.none')}
        </p>
      ) : null}
    </div>
  );

  const nameField = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    generated: string,
  ) => (
    <Field
      name={id}
      label={label}
      value={value}
      maxLength={200}
      disabled={locked}
      hint={value.trim() === '' ? `${t('services.generated')} : ${generated}` : undefined}
      onChange={(e) => {
        set(e.target.value);
        touched();
      }}
    />
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <section className="border-gris-200 bg-blanc flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
        <h2 className="text-encre text-lg font-bold">{t('services.texts')}</h2>
        {nameField(
          'custom_name_fr',
          t('services.nameFr'),
          customNameFr,
          setCustomNameFr,
          service.nameFr,
        )}
        {nameField(
          'custom_name_en',
          t('services.nameEn'),
          customNameEn,
          setCustomNameEn,
          service.nameEn,
        )}
        {textArea(
          'custom_description_fr',
          t('services.descriptionFr'),
          descFr,
          setDescFr,
          service.descriptionFr,
        )}
        {textArea(
          'custom_description_en',
          t('services.descriptionEn'),
          descEn,
          setDescEn,
          service.descriptionEn,
        )}
      </section>

      <section className="border-gris-200 bg-blanc flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
        <h2 className="text-encre text-lg font-bold">{t('services.pricing')}</h2>
        <Field
          name="multiplier"
          type="text"
          inputMode="decimal"
          label={t('services.multiplier')}
          hint={t('services.multiplierHint')}
          value={multiplier}
          disabled={locked}
          onChange={(e) => {
            setMultiplier(e.target.value);
            touched();
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-fit"
            loading={previewing}
            loadingLabel={t('services.previewLoading')}
            disabled={locked || !multiplierValid}
            onClick={() => void loadPreview()}
          >
            {t('services.preview')}
          </Button>
          {shownPreview ? (
            <p className="text-encre text-sm font-semibold tabular-nums" aria-live="polite">
              {t('services.previewResult', {
                oldPrice: formatXaf(shownPreview.oldXaf, locale),
                newPrice: formatXaf(shownPreview.newXaf, locale),
              })}
            </p>
          ) : null}
        </div>
        <Field
          name="sort_order"
          type="text"
          inputMode="numeric"
          label={t('services.sortOrder')}
          hint={t('services.sortHint')}
          value={sortOrder}
          disabled={locked}
          onChange={(e) => {
            setSortOrder(e.target.value);
            touched();
          }}
        />
      </section>

      {notice ? <FormAlert kind="error">{notice}</FormAlert> : null}
      {confirming ? (
        <p
          role="alert"
          className="bg-jaune-50 text-encre rounded-lg p-3 text-sm font-semibold tabular-nums"
        >
          {multiplierChanged && shownPreview
            ? t('services.confirmPrice', {
                oldPrice: formatXaf(shownPreview.oldXaf, locale),
                newPrice: formatXaf(shownPreview.newXaf, locale),
              })
            : t('services.confirmSave')}
        </p>
      ) : null}
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          className="w-full sm:w-fit"
          loading={pending}
          loadingLabel={t('orders.sending')}
          disabled={pending || previewing}
        >
          {confirming ? t('services.confirm') : t('services.save')}
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
