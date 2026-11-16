// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { AttachmentUpload } from '@/components/tickets/attachment-upload';
import { TicketForm } from '@/components/tickets/ticket-form';

// Corrections du rapport QA 9.5 : un bug corrigé = un test.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
const compress = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: compress }));

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {ui}
    </NextIntlClientProvider>,
  );
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  compress.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function fillAndSend(subject = 'other') {
  fireEvent.change(await screen.findByTestId('ticket-subject'), { target: { value: subject } });
  fireEvent.change(screen.getByTestId('ticket-body'), { target: { value: 'Bonjour' } });
  const submit = screen.getByTestId('ticket-submit');
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
}

describe('messages d’erreur selon details.reason', () => {
  const cases = [
    ['open_tickets', fr.support.errors.openTickets],
    ['rate', fr.support.errors.rateLimit],
    ['upload', fr.support.errors.uploadLimit],
  ] as const;
  for (const [reason, message] of cases) {
    it(`reason=${reason}`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          json(429, {
            error: { code: 'RATE_LIMITED', message: 'Trop de requêtes.', details: { reason } },
          }),
        ),
      );
      wrap(<TicketForm orders={[]} />);
      await fillAndSend();
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    });
  }

  it('les clés existent en FR et en EN', () => {
    for (const k of ['openTickets', 'uploadLimit', 'compressTimeout', 'compressing'] as const) {
      expect(fr.support.errors[k]).toBeTruthy();
      expect(en.support.errors[k]).toBeTruthy();
    }
  });
});

describe('formulaire', () => {
  it('efface l’erreur « Choisissez la commande » au choix de la commande', async () => {
    vi.stubGlobal('fetch', vi.fn());
    wrap(<TicketForm orders={[{ id: 'o1', label: 'Commande 1' }]} />);
    await fillAndSend('order');
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.support.form.needOrder);
    fireEvent.change(screen.getByTestId('ticket-order'), { target: { value: 'o1' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('compression', () => {
  it('abandonne avec un message clair après le délai maximal sans Web Worker', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    compress.mockImplementation(() => new Promise(() => undefined));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    wrap(<AttachmentUpload onChange={vi.fn()} />);
    const file = new File([new Uint8Array(10)], 'bruit.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('ticket-attach'), { target: { files: [file] } });
    expect(screen.getByRole('status')).toHaveTextContent(fr.support.errors.compressing);
    expect(compress.mock.calls[0]?.[1]).toMatchObject({ useWebWorker: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(fr.support.errors.compressTimeout);
    expect(screen.queryByRole('status')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
