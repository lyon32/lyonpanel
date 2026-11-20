'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  id: string;
  title: string;
  hint?: string;
  path: string;
  submitLabel: string;
  confirmLabel: string;
  successText: string;
  destructive?: boolean;
  /** Champs propres à l'action (montant, case à cocher). */
  children?: ReactNode;
  /** Validité des champs propres à l'action. */
  fieldsValid: boolean;
  /** Corps de la requête, motif compris. */
  buildBody: (reason: string) => Record<string, unknown>;
  /** Phrase de récapitulatif montrée avant l'envoi (obligatoire pour l'argent). */
  recap?: string;
  /** En-têtes de la requête (clé d'idempotence). */
  headers?: Record<string, string>;
  /** Appelé quand le motif change, ou après un succès : la clé d'idempotence se renouvelle. */
  onReset?: () => void;
};

// Formulaire commun des actions sur une commande : motif obligatoire, puis confirmation explicite.
// Le bouton est désactivé pendant l'envoi (anti double clic).
export function OrderActionForm(p: Props) {
  const t = useTranslations('admin');
  const { pending, feedback, run, clearFeedback } = useAdminAction({
    error: t('common.error'),
    success: p.successText,
  });
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const valid = p.fieldsValid && reason.trim().length >= 2;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !valid) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void send();
  }

  async function send() {
    const res = await run(p.path, 'POST', p.buildBody(reason.trim()), undefined, p.headers);
    if (res.ok) {
      setReason('');
      p.onReset?.();
    }
    setConfirming(false);
  }

  const reasonId = `${p.id}-reason`;
  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${p.id}-title`}
      className="border-gris-200 bg-blanc flex flex-col gap-3 rounded-xl border p-4 sm:p-5"
    >
      <h3 id={`${p.id}-title`} className="text-encre text-lg font-bold">
        {p.title}
      </h3>
      {p.hint ? <p className="text-gris-600 text-sm">{p.hint}</p> : null}
      <fieldset disabled={pending || confirming} className="flex flex-col gap-3">
        {p.children}
        <label htmlFor={reasonId} className="text-encre text-sm font-semibold">
          {t('orders.reason')}
        </label>
        <Textarea
          id={reasonId}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            clearFeedback();
            p.onReset?.();
          }}
          maxLength={500}
          required
        />
      </fieldset>
      {confirming && p.recap ? (
        <p role="alert" className="bg-jaune-50 text-encre rounded-lg p-3 text-sm font-semibold">
          {p.recap}
        </p>
      ) : null}
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          variant={p.destructive ? 'destructive' : 'primary'}
          className="w-full sm:w-fit"
          loading={pending}
          loadingLabel={t('orders.sending')}
          disabled={pending || !valid}
        >
          {confirming ? p.confirmLabel : p.submitLabel}
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
