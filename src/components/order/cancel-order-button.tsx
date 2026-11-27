'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type Step = 'idle' | 'confirm' | 'sending' | 'done';

/** Annulation d'une commande qui n'a pas démarré : confirmation, puis demande envoyée, examinée par l'équipe (aucun remboursement automatique). */
export function CancelOrderButton({ orderId, amountXaf }: { orderId: string; amountXaf: number }) {
  const t = useTranslations('orderTracking');
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setStep('sending');
    setError(null);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Accept-Language': locale },
      });
      if (res.ok) {
        setStep('done');
        router.refresh();
        return;
      }
      const body: { error?: { message?: string } } | null = await res.json().catch(() => null);
      setError(body?.error?.message || t('cancelFailed'));
    } catch {
      setError(t('cancelFailed'));
    }
    setStep('idle');
  }

  if (step === 'done') return <p className="text-succes text-sm">{t('cancelDone')}</p>;

  if (step === 'confirm' || step === 'sending') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-encre text-sm">
          {t('cancelConfirm', { amount: new Intl.NumberFormat(locale).format(amountXaf) })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={step === 'sending'}
            onClick={cancel}
            data-testid="cancel-confirm"
            className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 min-h-11 rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-4 disabled:opacity-60"
          >
            {step === 'sending' ? t('cancelSending') : t('cancelYes')}
          </button>
          <button
            type="button"
            disabled={step === 'sending'}
            onClick={() => setStep('idle')}
            className="border-gris-200 text-encre hover:bg-gris-50 min-h-11 rounded-lg border px-4 text-sm font-medium outline-none focus-visible:ring-4"
          >
            {t('cancelNo')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setStep('confirm')}
        data-testid="cancel-order"
        className="border-gris-200 text-encre hover:bg-gris-50 min-h-11 self-start rounded-lg border px-4 text-sm font-medium outline-none focus-visible:ring-4"
      >
        {t('cancel')}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
