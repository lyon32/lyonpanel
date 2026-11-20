// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketActions } from '@/components/admin/ticket-actions';
import en from '@/messages/admin.en.json';
import fr from '@/messages/admin.fr.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const ID = '11111111-1111-4111-8111-111111111111';

function show(status: string, lang: 'fr' | 'en' = 'fr') {
  return render(
    <NextIntlClientProvider locale={lang} messages={lang === 'fr' ? fr : en}>
      <TicketActions ticketId={ID} status={status} />
    </NextIntlClientProvider>,
  );
}

function mockFetch(ok = true, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 400, json: async () => body });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('TicketActions', () => {
  it('envoie la réponse trimée et vide le champ', async () => {
    const fetchMock = mockFetch();
    show('open');
    const field = screen.getByLabelText('Votre réponse') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: '  Bonjour  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v1/admin/tickets/${ID}/messages`);
    expect(JSON.parse(init.body as string)).toEqual({ body: 'Bonjour' });
    await waitFor(() => expect(field.value).toBe(''));
  });

  it('bloque une réponse vide', () => {
    show('open');
    expect(screen.getByRole('button', { name: 'Envoyer la réponse' })).toBeDisabled();
  });

  it('ferme un ticket ouvert', async () => {
    const fetchMock = mockFetch();
    show('answered');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le ticket' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v1/admin/tickets/${ID}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'closed' });
  });

  it('rouvre un ticket fermé, sans champ de réponse', async () => {
    const fetchMock = mockFetch();
    show('closed', 'en');
    expect(screen.queryByLabelText('Your reply')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen ticket' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ status: 'open' });
  });

  it("affiche le message d'erreur de l'API", async () => {
    mockFetch(false, { error: { code: 'TICKET_NOT_FOUND', message: 'Ticket introuvable.' } });
    show('open');
    fireEvent.change(screen.getByLabelText('Votre réponse'), { target: { value: 'Salut' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer la réponse' }));
    expect(await screen.findByText('Ticket introuvable.')).toBeTruthy();
  });
});
