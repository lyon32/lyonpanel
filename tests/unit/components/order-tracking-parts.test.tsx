// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { OrderProgressBar } from '@/components/order/order-progress-bar';
import { OrderStatusBadge } from '@/components/order/order-status-badge';

/*
 * Composants attendus (plan 7.4) :
 *   src/components/order/order-status-badge.tsx : OrderStatusBadge({ status })
 *     rend un élément data-testid="order-status-badge" data-status={status} avec le libellé traduit ;
 *   src/components/order/order-progress-bar.tsx : OrderProgressBar({ quantity, remains })
 *     rend role="progressbar" aria-valuenow = round((quantity - remains) / quantity * 100), min 0, max 100.
 * Aucun libellé ne contient « fournisseur » / « provider ».
 */

const STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'partial',
  'canceled',
  'to_review',
  'refunded',
] as const;

function badge(status: string, locale: 'fr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <OrderStatusBadge status={status as never} />
    </NextIntlClientProvider>,
  );
}

describe('OrderStatusBadge', () => {
  it.each([
    ['pending', /en attente|en envoi/i],
    ['in_progress', /en cours/i],
    ['completed', /termin/i],
    ['to_review', /en cours de vérification/i],
    ['refunded', /rembours/i],
  ])('FR : %s affiche le bon libellé', (status, label) => {
    badge(status, 'fr');
    const el = screen.getByTestId('order-status-badge');
    expect(el).toHaveAttribute('data-status', status);
    expect(el).toHaveTextContent(label);
  });

  it.each([
    ['pending', /pending|sending/i],
    ['in_progress', /in progress/i],
    ['completed', /completed/i],
    ['to_review', /review/i],
    ['refunded', /refund/i],
  ])('EN : %s affiche le bon libellé', (status, label) => {
    badge(status, 'en');
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent(label);
  });

  it.each(STATUSES.flatMap((s) => [[s, 'fr'] as const, [s, 'en'] as const]))(
    '%s (%s) : jamais le nom du fournisseur ni de texte brut',
    (status, locale) => {
      badge(status, locale);
      const text = screen.getByTestId('order-status-badge').textContent ?? '';
      expect(text.trim()).not.toBe('');
      expect(text).not.toMatch(/fournisseur|provider|jap|order\.status|orders\./i);
      expect(text).not.toBe(status);
    },
  );

  it('partiel et annulé s affichent comme « en cours de vérification » (le client ne voit pas le détail)', () => {
    for (const status of ['partial', 'canceled']) {
      const { unmount } = badge(status, 'fr');
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent(
        /en cours de vérification/i,
      );
      unmount();
    }
  });
});

describe('OrderProgressBar', () => {
  const bar = (quantity: number, remains: number) =>
    render(
      <NextIntlClientProvider locale="fr" messages={fr}>
        <OrderProgressBar quantity={quantity} remains={remains} />
      </NextIntlClientProvider>,
    );

  it.each([
    [1000, 1000, 0],
    [1000, 750, 25],
    [1000, 400, 60],
    [1000, 0, 100],
    [300, 100, 67],
  ])('quantité %i, reste %i : %i %%', (quantity, remains, pct) => {
    bar(quantity, remains);
    const el = screen.getByRole('progressbar');
    expect(el).toHaveAttribute('aria-valuenow', String(pct));
    expect(el).toHaveAttribute('aria-valuemin', '0');
    expect(el).toHaveAttribute('aria-valuemax', '100');
  });

  it('reste supérieur à la quantité : bloqué à 0 %, jamais négatif', () => {
    bar(100, 150);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('reste négatif : bloqué à 100 %', () => {
    bar(100, -5);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('quantité 0 : pas de division par zéro, 0 %', () => {
    bar(0, 0);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
