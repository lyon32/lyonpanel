// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersList, type OrderListItem } from '@/components/order/orders-list';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

vi.mock('@/hooks/use-order-polling', () => ({ useOrderPolling: () => undefined }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const order: OrderListItem = {
  id: 'o1',
  shortId: 7,
  serviceName: 'Abonnés Instagram',
  quantity: 1000,
  chargedXaf: 5000,
  status: 'partial',
  remains: 400,
  cancellable: false,
};

function show(o: Partial<OrderListItem>, lang: 'fr' | 'en' = 'fr') {
  return render(
    <NextIntlClientProvider locale={lang} messages={lang === 'fr' ? fr : en}>
      <OrdersList orders={[{ ...order, ...o }]} />
    </NextIntlClientProvider>,
  );
}

describe('historique client : remboursement partiel', () => {
  it('affiche la part rendue', () => {
    show({ refundedXaf: 2000 });
    expect(screen.getByText(/Remboursé partiellement : 2\s?000 XAF/)).toBeInTheDocument();
  });

  it('en anglais', () => {
    show({ refundedXaf: 2000 }, 'en');
    expect(screen.getByText(/Partially refunded: 2,000 XAF/)).toBeInTheDocument();
  });

  it('rien à afficher sans remboursement ou quand tout est rendu', () => {
    show({ refundedXaf: 0 });
    expect(screen.queryByText(/Remboursé partiellement/)).toBeNull();
    show({ refundedXaf: 5000, status: 'refunded' });
    expect(screen.queryByText(/Remboursé partiellement/)).toBeNull();
  });

  it('aucun texte Mobile Money ni nom de fournisseur dans les textes de suivi', () => {
    const text = JSON.stringify([fr.orderTracking, en.orderTracking]);
    expect(text).not.toMatch(/mobile money|fournisseur|provider|JAP/i);
  });

  it('états en attente et en cours', () => {
    show({ status: 'pending' });
    expect(screen.getByText('En attente d’envoi')).toBeInTheDocument();
    show({ status: 'in_progress' });
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });
});
