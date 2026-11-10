'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { fetchQuote, startPayment, type Quote } from './payments-client';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const QUOTE_DELAY_MS = 350;
const QUICK_AMOUNTS = [1000, 3000, 5000, 10000];

export function AddFundsForm({
  minXaf,
  maxXaf,
  balanceXaf,
}: {
  minXaf: number;
  maxXaf: number;
  balanceXaf: number;
}) {
  const t = useTranslations('wallet');
  const locale = useLocale();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Numéro de la dernière saisie : la réponse tardive d'un ancien montant est ignorée.
  const latest = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const xaf = (value: number) => `${format.format(value)} XAF`;

  // Renvoie le message d'erreur à afficher, ou null si le montant peut être envoyé au serveur.
  function checkAmount(raw: string, amount: number, onSubmit: boolean): string | null {
    if (!raw.trim() || !Number.isInteger(amount)) {
      return onSubmit ? t('enterAmount') : null;
    }
    if (amount < minXaf) return t('minAmount', { min: format.format(minXaf) });
    if (amount > maxXaf) return t('maxAmount', { max: format.format(maxXaf) });
    return null;
  }

  async function refreshQuote(raw: string, ticket: number): Promise<Quote | null> {
    const amount = Number(raw);
    // Bornes vérifiées avant tout appel réseau ; le serveur reste la source de vérité.
    const problem = checkAmount(raw, amount, true);
    if (problem) {
      setQuote(null);
      setError(problem);
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
    scheduleQuote(event.target.value);
  }

  // Un montant rapide remplit seulement le champ ; le devis suit comme pour une saisie.
  function pickAmount(amount: number) {
    const input = formRef.current?.elements.namedItem('amount');
    if (input instanceof HTMLInputElement) input.value = String(amount);
    scheduleQuote(String(amount));
  }

  function scheduleQuote(raw: string) {
    latest.current += 1;
    const ticket = latest.current;
    window.clearTimeout(timer.current);
    const amount = Number(raw);
    // Saisie vide, non numérique ou hors bornes : pas de devis, erreur affichée tout de suite.
    if (!raw.trim() || !Number.isInteger(amount) || amount < minXaf || amount > maxXaf) {
      setQuote(null);
      setLoadingQuote(false);
      setError(checkAmount(raw, amount, false));
      return;
    }
    setLoadingQuote(true);
    timer.current = window.setTimeout(() => {
      void refreshQuote(raw, ticket).finally(() => {
        if (ticket === latest.current) setLoadingQuote(false);
      });
    }, QUOTE_DELAY_MS);
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border-gris-200 bg-blanc flex max-w-md flex-col gap-5 rounded-xl border p-4 sm:p-6"
      noValidate
    >
      <p
        data-testid="current-balance"
        className="bg-gris-50 text-encre flex items-baseline justify-between rounded-lg px-3 py-3 text-sm tabular-nums"
      >
        <span className="text-gris-600">{t('currentBalance')}</span>
        <span className="text-bleu-600 text-lg font-bold">{xaf(balanceXaf)}</span>
      </p>
      <Field
        inputClassName="border-gris-400"
        label={t('amountLabel')}
        hint={t('amountHint')}
        name="amount"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-testid="amount-input"
        onChange={handleChange}
      />
      <div role="group" aria-label={t('quickAmounts')} className="grid grid-cols-2 gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => pickAmount(amount)}
            className="border-gris-200 text-encre hover:border-bleu-600 hover:bg-bleu-50 focus-visible:outline-bleu-600 min-h-11 rounded-lg border text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {xaf(amount)}
          </button>
        ))}
      </div>
      <dl className="border-gris-200 flex flex-col gap-2 border-t pt-4 text-sm tabular-nums">
        <div className="text-gris-600 flex justify-between">
          <dt>{t('fee')}</dt>
          <dd data-testid="quote-fee">{quote ? xaf(quote.feeXaf) : '-'}</dd>
        </div>
        <div className="text-encre flex items-baseline justify-between">
          <dt className="font-semibold">{t('total')}</dt>
          <dd data-testid="quote-total" className="text-2xl font-bold">
            {quote ? xaf(quote.totalToPay) : '-'}
          </dd>
        </div>
      </dl>
      <p aria-live="polite" className="text-gris-600 -mt-3 min-h-5 text-sm">
        {loadingQuote ? t('quoteLoading') : ''}
      </p>
      {error ? <FormAlert kind="error">{error}</FormAlert> : null}
      <Button
        type="submit"
        loading={pending}
        loadingLabel={t('redirecting')}
        data-testid="pay-submit"
      >
        {t('pay')}
      </Button>
      <p className="text-gris-600 text-center text-sm">{t('secureNote')}</p>
    </form>
  );
}
