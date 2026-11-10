'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  fetchOrderQuote,
  placeOrderRequest,
  type Failure,
  type OrderOutcome,
  type OrderQuote,
} from './order-client';
import type { OrderStep } from './order-progress';

const STEP_DEBIT_MS = 500;
const STEP_SUBMIT_MS = 1200;

export const commentLines = (raw: string) =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

type ServiceLimits = { id: number; minQty: number; maxQty: number; needsComments: boolean };

export type SubmitInput = {
  link: string;
  quantityRaw: string;
  commentsRaw: string;
  quote: OrderQuote | null;
};

// Ce que l'écran doit afficher une fois la tentative terminée.
export type SubmitEffect =
  | { kind: 'error'; message: string; quote?: OrderQuote; requote?: boolean }
  | { kind: 'missing'; missingXaf: number | null; quote?: OrderQuote }
  | { kind: 'done'; outcome: OrderOutcome };

// Traduction des erreurs serveur en messages clairs (FR/EN).
export function useFailureMessage(service: ServiceLimits, money: (xaf: number) => string) {
  const t = useTranslations('order');
  return (failure: Failure, locale: string): string => {
    const d = failure.details;
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    switch (failure.code) {
      case 'PRICE_CHANGED':
        return typeof d.new_total_xaf === 'number'
          ? t('priceChanged', { total: money(d.new_total_xaf) })
          : t('priceChangedNoTotal');
      case 'DAILY_LIMIT_REACHED':
        return typeof d.limit_xaf === 'number'
          ? t('dailyLimit', { limit: money(d.limit_xaf) })
          : failure.message;
      case 'QUANTITY_OUT_OF_RANGE':
        return t('quantityRange', {
          min: number.format(service.minQty),
          max: number.format(service.maxQty),
        });
      case 'NETWORK':
        return t('networkError');
      default:
        return failure.message || t('genericError');
    }
  };
}

// Séquence de soumission : devis frais, clé d'idempotence, envoi, traduction des erreurs.
export function useOrderSubmit(
  service: ServiceLimits,
  locale: string,
  money: (xaf: number) => string,
) {
  const t = useTranslations('order');
  const messageOf = useFailureMessage(service, money);
  const [step, setStep] = useState<OrderStep | null>(null);
  // Garde synchrone : un double clic arrive avant que le bouton soit désactivé à l'écran.
  const sending = useRef(false);
  const timers = useRef<number[]>([]);
  // Une clé par tentative : réutilisée tant que le contenu est identique (réessai sûr).
  const attempt = useRef<{ key: string; signature: string } | null>(null);

  function clearStepTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  function stop() {
    clearStepTimers();
    setStep(null);
    sending.current = false;
  }

  // Renvoie null si une soumission est déjà en cours.
  async function submit(input: SubmitInput): Promise<SubmitEffect | null> {
    if (sending.current) return null;
    sending.current = true;
    setStep('sending');
    timers.current = [
      window.setTimeout(() => setStep((s) => (s === 'sending' ? 'debiting' : s)), STEP_DEBIT_MS),
      window.setTimeout(
        () => setStep((s) => (s === 'debiting' ? 'submitting' : s)),
        STEP_SUBMIT_MS,
      ),
    ];
    try {
      const { link, quantityRaw, commentsRaw, quote } = input;
      // Total redemandé au serveur : si le prix a bougé, on le montre avant de débiter.
      const fresh = await fetchOrderQuote(service.id, Number(quantityRaw), locale);
      if (!fresh.ok) {
        stop();
        return { kind: 'error', message: messageOf(fresh.error, locale) };
      }
      if (quote && fresh.value.totalXaf !== quote.totalXaf) {
        stop();
        return {
          kind: 'error',
          message: t('priceChanged', { total: money(fresh.value.totalXaf) }),
          quote: fresh.value,
        };
      }
      if (fresh.value.balanceAfterXaf < 0) {
        stop();
        return { kind: 'missing', missingXaf: null, quote: fresh.value };
      }

      const comments = service.needsComments ? commentLines(commentsRaw) : undefined;
      const signature = JSON.stringify([
        service.id,
        link.trim(),
        quantityRaw,
        comments ?? null,
        fresh.value.totalXaf,
      ]);
      if (attempt.current?.signature !== signature) {
        attempt.current = { key: crypto.randomUUID(), signature };
      }
      const result = await placeOrderRequest(
        {
          serviceId: service.id,
          link: link.trim(),
          quantity: Number(quantityRaw),
          comments,
          expectedTotalXaf: fresh.value.totalXaf,
        },
        locale,
        attempt.current.key,
      );
      if (!result.ok) {
        const failure = result.error;
        stop();
        if (
          failure.code === 'INSUFFICIENT_BALANCE' &&
          typeof failure.details.missing_xaf === 'number'
        ) {
          return { kind: 'missing', missingXaf: failure.details.missing_xaf, quote: fresh.value };
        }
        return {
          kind: 'error',
          message: messageOf(failure, locale),
          quote: fresh.value,
          requote:
            failure.code === 'PRICE_CHANGED' && typeof failure.details.new_total_xaf === 'number',
        };
      }
      clearStepTimers();
      setStep('done');
      return { kind: 'done', outcome: result.value };
    } catch {
      stop();
      return { kind: 'error', message: t('networkError') };
    }
  }

  return { step, submit, messageOf };
}
