'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchOrderQuote, type OrderOutcome, type OrderQuote } from './order-client';
import { CommentsField, MissingBalance, WalletBalance } from './order-parts';
import { commentLines, useOrderSubmit } from './use-order-submit';
import { OrderResult } from './order-result';
import { OrderProgress } from './order-progress';
import { ServiceCard } from './service-card';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import type { Currency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';
import { Link } from '@/i18n/navigation';

const QUOTE_DELAY_MS = 300;

export type OrderService = {
  id: number;
  name: string;
  platform: string;
  priceXaf1000: number;
  minQty: number;
  maxQty: number;
  needsComments: boolean;
};

type Props = {
  service: OrderService;
  currency: Currency;
  usdXafRate: number;
  balanceXaf: number;
};

export function OrderForm({ service, currency, usdXafRate, balanceXaf }: Props) {
  const t = useTranslations('order');
  const locale = useLocale();
  const router = useRouter();
  const [link, setLink] = useState('');
  const [quantityRaw, setQuantityRaw] = useState('');
  const [commentsRaw, setCommentsRaw] = useState('');
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    link?: string;
    quantity?: string;
    comments?: string;
  }>({});
  const [serverMissingXaf, setServerMissingXaf] = useState<number | null>(null);
  const [balance, setBalance] = useState(balanceXaf);
  const [outcome, setOutcome] = useState<OrderOutcome | null>(null);
  // Numéro de la dernière saisie : la réponse tardive d'un ancien devis est ignorée.
  const latest = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const money = (xaf: number) => formatCatalogMoney(xaf, currency, locale, usdXafRate);
  const { step, submit, messageOf } = useOrderSubmit(service, locale, money);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const isSending = step !== null && step !== 'done';
  const missingXaf =
    serverMissingXaf ?? (quote && quote.balanceAfterXaf < 0 ? -quote.balanceAfterXaf : null);

  function quantityProblem(raw: string): string | null {
    const value = Number(raw);
    if (!raw.trim() || !Number.isInteger(value) || value <= 0) return t('enterQuantity');
    if (value < service.minQty || value > service.maxQty) {
      return t('quantityRange', {
        min: number.format(service.minQty),
        max: number.format(service.maxQty),
      });
    }
    return null;
  }

  function scheduleQuote(raw: string) {
    latest.current += 1;
    const ticket = latest.current;
    window.clearTimeout(timer.current);
    setQuote(null);
    setServerMissingXaf(null);
    setError(null);
    if (quantityProblem(raw)) {
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    timer.current = window.setTimeout(() => {
      void fetchOrderQuote(service.id, Number(raw), locale).then((result) => {
        if (ticket !== latest.current) return;
        setQuoteLoading(false);
        if (result.ok) setQuote(result.value);
        else setError(messageOf(result.error, locale));
      });
    }, QUOTE_DELAY_MS);
  }

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!link.trim()) next.link = t('enterLink');
    const qProblem = quantityProblem(quantityRaw);
    if (qProblem) next.quantity = qProblem;
    if (service.needsComments && commentLines(commentsRaw).length !== Number(quantityRaw)) {
      next.comments = t('commentsCount', { count: number.format(Number(quantityRaw) || 0) });
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  // Page hydratée tard : des champs peuvent déjà être remplis, on relit le formulaire.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const read = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
    const filledLink = read('link');
    const filledQuantity = read('quantity');
    const filledComments = read('comments');
    if (filledLink) setLink(filledLink);
    if (filledComments) setCommentsRaw(filledComments);
    if (filledQuantity) {
      setQuantityRaw(filledQuantity);
      scheduleQuote(filledQuantity);
    }
    // Une seule fois, à l'hydratation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    setError(null);
    if (!validate()) return;
    window.clearTimeout(timer.current);
    latest.current += 1;
    const effect = await submit({ link, quantityRaw, commentsRaw, quote });
    if (!effect) return;
    if (effect.kind === 'done') {
      setOutcome(effect.outcome);
      setBalance((b) => b - effect.outcome.chargedXaf);
      router.refresh();
      return;
    }
    if (effect.quote) setQuote(effect.quote);
    if (effect.kind === 'missing') {
      setServerMissingXaf(effect.missingXaf);
      return;
    }
    setError(effect.message);
    if (effect.requote) {
      setQuote(null);
      scheduleQuote(quantityRaw);
    }
  }

  const finished = outcome !== null;

  return (
    <>
      <WalletBalance amount={money(balance)} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isSending || undefined}
          className="border-gris-200 bg-blanc flex flex-col gap-5 rounded-xl border p-4 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <span className="text-encre text-sm font-semibold">{t('serviceLabel')}</span>
            <p data-testid="order-service" className="text-encre text-base">
              {service.name}
            </p>
          </div>
          <Field
            label={t('linkLabel')}
            hint={t('linkHint')}
            error={fieldErrors.link}
            name="link"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            data-testid="order-link"
            value={link}
            disabled={isSending || finished}
            onChange={(e) => {
              setLink(e.target.value);
              setFieldErrors((f) => ({ ...f, link: undefined }));
              setError(null);
            }}
          />
          <Field
            label={t('quantityLabel')}
            hint={t('quantityHint', {
              min: number.format(service.minQty),
              max: number.format(service.maxQty),
            })}
            error={fieldErrors.quantity}
            name="quantity"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="order-quantity"
            value={quantityRaw}
            disabled={isSending || finished}
            onChange={(e) => {
              setQuantityRaw(e.target.value);
              setFieldErrors((f) => ({ ...f, quantity: undefined }));
              scheduleQuote(e.target.value);
            }}
          />
          {service.needsComments ? (
            <CommentsField
              value={commentsRaw}
              error={fieldErrors.comments}
              disabled={isSending || finished}
              onChange={(value) => {
                setCommentsRaw(value);
                setFieldErrors((f) => ({ ...f, comments: undefined }));
              }}
            />
          ) : null}

          <dl className="border-gris-200 flex flex-col gap-2 border-t pt-4 text-sm tabular-nums">
            <div className="text-encre flex items-baseline justify-between">
              <dt className="font-semibold">{t('total')}</dt>
              <dd data-testid="quote-total" className="text-2xl font-bold">
                {quote ? money(quote.totalXaf) : '-'}
              </dd>
            </div>
            <div className="text-gris-600 flex justify-between">
              <dt>{t('balanceAfter')}</dt>
              <dd data-testid="quote-balance-after">
                {quote && quote.balanceAfterXaf >= 0 ? money(quote.balanceAfterXaf) : '-'}
              </dd>
            </div>
            {quote && quote.discountPct > 0 ? (
              <div className="text-gris-600 flex justify-between">
                <dt>{t('discount')}</dt>
                <dd>{`-${quote.discountPct} %`}</dd>
              </div>
            ) : null}
          </dl>
          <p aria-live="polite" className="text-gris-600 -mt-3 min-h-5 text-sm">
            {quoteLoading ? t('quoteLoading') : ''}
          </p>

          {error ? (
            <div data-testid="order-error">
              <FormAlert kind="error">{error}</FormAlert>
            </div>
          ) : null}

          {missingXaf !== null && !finished ? <MissingBalance amount={money(missingXaf)} /> : null}

          {step ? <OrderProgress step={step} /> : null}

          {outcome ? <OrderResult outcome={outcome} /> : null}

          {!finished && missingXaf === null ? (
            <Button
              type="submit"
              loading={isSending}
              loadingLabel={t('sending')}
              data-testid="order-submit"
            >
              {quote ? t('submitWithTotal', { total: money(quote.totalXaf) }) : t('submit')}
            </Button>
          ) : null}
          {finished ? (
            <Link
              href={{ pathname: '/services' }}
              className="border-gris-200 text-encre hover:bg-gris-50 inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-base font-semibold"
            >
              {t('newOrder')}
            </Link>
          ) : null}
        </form>
        <ServiceCard service={service} money={money} />
      </div>
    </>
  );
}
