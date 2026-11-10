'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { fetchQuote, startPayment, type Quote } from './payments-client';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const QUOTE_DELAY_MS = 350;

export function AddFundsForm() {
  const t = useTranslations('wallet');
  const locale = useLocale();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Numéro de la dernière saisie : la réponse tardive d'un ancien montant est ignorée.
  const latest = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const xaf = (value: number) => `${format.format(value)} XAF`;

  async function refreshQuote(raw: string, ticket: number): Promise<Quote | null> {
    const amount = Number(raw);
    if (!raw.trim() || !Number.isInteger(amount)) {
      setQuote(null);
      setError(raw.trim() ? t('invalidAmount') : null);
      return null;
    }
    const result = await fetchQuote(amount, locale);
    if (ticket !== latest.current) return null;
    if (result.ok) {
      setQuote(result.value);
      setError(null);
      return result.value;
    }
    setQuote(null);
    setError(result.error.message || t('networkError'));
    return null;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    latest.current += 1;
    const ticket = latest.current;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void refreshQuote(raw, ticket), QUOTE_DELAY_MS);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get('amount') ?? '');
    window.clearTimeout(timer.current);
    latest.current += 1;
    setPending(true);
    // Le devis est redemandé au serveur : pas de paiement tant que le montant n'est pas accepté.
    const checked = await refreshQuote(raw, latest.current);
    if (!checked) {
      setPending(false);
      return;
    }
    const result = await startPayment(checked.amountXaf, locale, crypto.randomUUID());
    if (!result.ok) {
      setError(result.error.message || t('networkError'));
      setPending(false);
      return;
    }
    window.location.assign(result.value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <Field
        label={t('amountLabel')}
        hint={t('amountHint')}
        name="amount"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-testid="amount-input"
        onChange={handleChange}
      />
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <dt>{t('fee')}</dt>
          <dd data-testid="quote-fee">{quote ? xaf(quote.feeXaf) : '-'}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>{t('total')}</dt>
          <dd data-testid="quote-total">{quote ? xaf(quote.totalToPay) : '-'}</dd>
        </div>
      </dl>
      {error ? <FormAlert kind="error">{error}</FormAlert> : null}
      <Button
        type="submit"
        loading={pending}
        loadingLabel={t('redirecting')}
        data-testid="pay-submit"
      >
        {t('pay')}
      </Button>
    </form>
  );
}
