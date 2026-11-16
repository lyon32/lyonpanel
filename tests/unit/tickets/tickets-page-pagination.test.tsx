// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Page tickets 9.3h : « Voir plus », « Retour au début », curseur invalide.
const m = vi.hoisted(() => ({ listTickets: vi.fn(), listOrders: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
  }) => {
    const url =
      typeof href === 'string'
        ? href
        : `${href.pathname}${href.query ? `?cursor=${href.query.cursor}` : ''}`;
    return (
      <a href={url} {...rest}>
        {children}
      </a>
    );
  },
}));
vi.mock('@/components/tickets/support-faq', () => ({ SupportFaq: () => null }));
vi.mock('@/components/tickets/ticket-form', () => ({ TicketForm: () => null }));
vi.mock('@/server/auth/require-user', () => ({ requireUser: async () => ({ id: 'user-1' }) }));
vi.mock('@/server/orders/list-orders', () => ({ listOrders: m.listOrders }));
vi.mock('@/server/tickets/tickets', () => ({
  listTickets: m.listTickets,
  shortTicketId: (id: string) => id.slice(0, 6),
}));

import TicketsPage from '@/app/[locale]/(app)/tickets/page';
import { ApiError } from '@/server/http/api-error';

const ticket = {
  id: 'aaaaaa-1',
  subject: 'other',
  status: 'open',
  updated_at: '2026-11-01T10:00:00Z',
};

async function show(cursor?: string | string[]) {
  const ui = await TicketsPage({
    params: Promise.resolve({ locale: 'fr' }),
    searchParams: Promise.resolve({ cursor }),
  });
  render(ui);
}

beforeEach(() => {
  m.listTickets.mockReset();
  m.listOrders.mockReset();
  m.listOrders.mockResolvedValue({ data: [] });
});

describe('page tickets : pagination', () => {
  it('première page : pas de lien Retour, pas de Voir plus sans suite', async () => {
    m.listTickets.mockResolvedValue({ items: [ticket], next_cursor: null });
    await show();
    expect(screen.queryByTestId('tickets-back')).toBeNull();
    expect(screen.queryByTestId('tickets-more')).toBeNull();
  });

  it('avec next_cursor : Voir plus pointe vers ?cursor=', async () => {
    m.listTickets.mockResolvedValue({ items: [ticket], next_cursor: 'abc123' });
    await show();
    expect(screen.getByTestId('tickets-more').getAttribute('href')).toBe('/tickets?cursor=abc123');
    expect(screen.queryByTestId('tickets-back')).toBeNull();
  });

  it('curseur valide : lit la page suivante et affiche Retour au début', async () => {
    m.listTickets.mockResolvedValue({ items: [ticket], next_cursor: null });
    await show('abc123');
    expect(m.listTickets).toHaveBeenCalledWith('user-1', { cursor: 'abc123', limit: 20 });
    expect(screen.getByTestId('tickets-back').getAttribute('href')).toBe('/tickets');
  });

  it('curseur refusé par le serveur (ApiError) : première page, sans exception', async () => {
    m.listTickets
      .mockRejectedValueOnce(new ApiError('VALIDATION_ERROR', 400))
      .mockResolvedValueOnce({ items: [ticket], next_cursor: null });
    await show('modifie');
    expect(m.listTickets).toHaveBeenLastCalledWith('user-1', { limit: 20 });
    expect(screen.queryByTestId('tickets-back')).toBeNull();
    expect(screen.getAllByTestId('ticket-row')).toHaveLength(1);
  });

  it('curseur trop long ou multiple : première page sans appel avec ce curseur', async () => {
    m.listTickets.mockResolvedValue({ items: [], next_cursor: null });
    await show('x'.repeat(201));
    expect(m.listTickets).toHaveBeenCalledTimes(1);
    expect(m.listTickets).toHaveBeenCalledWith('user-1', { limit: 20 });
    await show(['a', 'b']);
    expect(m.listTickets).toHaveBeenLastCalledWith('user-1', { limit: 20 });
  });

  it('une erreur autre qu’ApiError remonte (pas masquée)', async () => {
    m.listTickets.mockRejectedValue(new Error('base en panne'));
    await expect(show('abc123')).rejects.toThrow('base en panne');
  });
});
