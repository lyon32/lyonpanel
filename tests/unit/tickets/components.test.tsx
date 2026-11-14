// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { must } from '../../helpers/must';
import fr from '@/messages/fr.json';
import { AttachmentUpload } from '@/components/tickets/attachment-upload';
import { SupportFaq } from '@/components/tickets/support-faq';
import { TicketForm } from '@/components/tickets/ticket-form';
import { TicketThread } from '@/components/tickets/ticket-thread';

/*
 * Composants attendus (src/components/tickets/), tous des composants client sauf SupportFaq :
 *   SupportFaq                         -> 5 [data-testid=faq-item] (question + réponse FR/EN de support.faq.items.*)
 *   AttachmentUpload {onChange(ids)}   -> input[data-testid=ticket-attach] (accept jpeg/png/webp, multiple), compresse chaque image
 *        avec « browser-image-compression » (maxSizeMB <= 2) puis POST /api/v1/tickets/attachments (FormData, champ « file ») ;
 *        une puce [data-testid=attachment-chip] par fichier envoyé, avec [data-testid=attachment-remove] ; 3 images max.
 *   TicketForm {orders: {id, label}[]} -> select[ticket-subject] (4 sujets), select[ticket-order] visible seulement pour « order »,
 *        textarea[ticket-body], bouton[ticket-submit] ; POST /api/v1/tickets {subject, order_id?, body, attachment_ids?} ;
 *        succès 201 {id} -> router.push (de '@/i18n/navigation') vers le ticket ; erreur -> [role=alert] avec error.message.
 *   TicketThread {ticket, messages}    -> [ticket-message][data-from-admin], pièces [ticket-attachment] (src = url signée),
 *        textarea[ticket-reply-body] + bouton[ticket-reply-send] (POST /api/v1/tickets/{id}/messages),
 *        bouton[ticket-close] (PATCH /api/v1/tickets/{id} {status:'closed'}) caché si fermé, [ticket-closed-notice] si fermé.
 */

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => nav }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const compress = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: compress }));

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      {ui}
    </NextIntlClientProvider>,
  );

const png = (name = 'capture.png', size = 5_000_000) =>
  new File([new Uint8Array(size)], name, { type: 'image/png' });

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  compress.mockReset();
  compress.mockImplementation(
    async (f: File) => new File([new Uint8Array(1000)], `petit-${f.name}`, { type: f.type }),
  );
  nav.push.mockReset();
  nav.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('SupportFaq', () => {
  it('affiche les 5 questions fixes avec leur réponse', () => {
    wrap(<SupportFaq />);
    const items = screen.getAllByTestId('faq-item');
    expect(items).toHaveLength(5);
    for (const key of [
      'delivery',
      'partial',
      'refund',
      'rechargeMissing',
      'privateLink',
    ] as const) {
      const { question, answer } = fr.support.faq.items[key];
      expect(screen.getByText(question)).toBeInTheDocument();
      expect(screen.getByText(answer)).toBeInTheDocument();
    }
  });
});

describe('AttachmentUpload', () => {
  const upload = (files: File[]) =>
    fireEvent.change(screen.getByTestId('ticket-attach'), { target: { files } });

  it('n’accepte que jpeg, png et webp', () => {
    wrap(<AttachmentUpload onChange={vi.fn()} />);
    const accept = screen.getByTestId('ticket-attach').getAttribute('accept') ?? '';
    expect(accept.split(',').sort()).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('compresse l’image dans le navigateur avant de l’envoyer, puis rend son identifiant', async () => {
    const onChange = vi.fn();
    const fetchMock = mockFetch(() => json(201, { id: 'att-1' }));
    wrap(<AttachmentUpload onChange={onChange} />);
    upload([png('ecran.png')]);

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['att-1']));
    expect(compress).toHaveBeenCalledTimes(1);
    expect(must(compress.mock.calls[0])[1].maxSizeMB).toBeLessThanOrEqual(2);
    const [url, init] = must(fetchMock.mock.calls[0]);
    expect(String(url)).toBe('/api/v1/tickets/attachments');
    expect(init?.method).toBe('POST');
    const sent = (init?.body as FormData).get('file') as File;
    expect(sent.name).toBe('petit-ecran.png');
    expect(sent.size).toBe(1000);
    expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1);
  });

  it('retire une image : son identifiant disparaît de la liste', async () => {
    const onChange = vi.fn();
    let n = 0;
    mockFetch(() => json(201, { id: `att-${++n}` }));
    wrap(<AttachmentUpload onChange={onChange} />);
    upload([png('a.png'), png('b.png')]);
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(2));
    fireEvent.click(
      within(must(screen.getAllByTestId('attachment-chip')[0])).getByTestId('attachment-remove'),
    );
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
    expect(onChange).toHaveBeenLastCalledWith(['att-2']);
  });

  it('refuse un fichier qui n’est pas une image : aucune compression, aucun envoi, message affiché', async () => {
    const fetchMock = mockFetch(() => json(201, { id: 'x' }));
    wrap(<AttachmentUpload onChange={vi.fn()} />);
    upload([new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.support.errors.fileType);
    expect(compress).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('plafonne à 3 images : la 4e n’est ni compressée ni envoyée', async () => {
    const fetchMock = mockFetch(() => json(201, { id: Math.random().toString(36) }));
    wrap(<AttachmentUpload onChange={vi.fn()} />);
    upload([png('1.png'), png('2.png'), png('3.png'), png('4.png')]);
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(3));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(compress).toHaveBeenCalledTimes(3);
    expect(await screen.findByRole('alert')).toHaveTextContent(fr.support.errors.fileTooMany);
  });

  it('si le serveur refuse l’image (422), n’ajoute aucune puce et affiche son message', async () => {
    const onChange = vi.fn();
    mockFetch(() =>
      json(422, {
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Le fichier est trop volumineux.',
          request_id: 'r',
        },
      }),
    );
    wrap(<AttachmentUpload onChange={onChange} />);
    upload([png()]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Le fichier est trop volumineux.');
    expect(screen.queryAllByTestId('attachment-chip')).toHaveLength(0);
  });
});

describe('TicketForm', () => {
  const orders = [
    { id: '0b0c0d0e-0000-4000-8000-000000000001', label: '#0B0C0D0E · TikTok abonnés' },
  ];
  const fill = (subject: string, body: string) => {
    fireEvent.change(screen.getByTestId('ticket-subject'), { target: { value: subject } });
    fireEvent.change(screen.getByTestId('ticket-body'), { target: { value: body } });
  };

  it('propose les 4 sujets fixes, sans champ libre pour le sujet', () => {
    wrap(<TicketForm orders={orders} />);
    const options = within(screen.getByTestId('ticket-subject')).getAllByRole('option');
    expect(options.map((o) => (o as HTMLOptionElement).value).filter(Boolean)).toEqual([
      'order',
      'recharge',
      'account',
      'other',
    ]);
    expect(screen.getByTestId('ticket-subject').tagName).toBe('SELECT');
  });

  it('montre le choix de la commande seulement pour le sujet « Commande »', () => {
    wrap(<TicketForm orders={orders} />);
    expect(screen.queryByTestId('ticket-order')).toBeNull();
    fireEvent.change(screen.getByTestId('ticket-subject'), { target: { value: 'order' } });
    expect(screen.getByTestId('ticket-order')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ticket-subject'), { target: { value: 'other' } });
    expect(screen.queryByTestId('ticket-order')).toBeNull();
  });

  it('n’envoie rien tant que le message est vide ou que la commande manque', () => {
    const fetchMock = mockFetch(() => json(201, { id: 't1' }));
    wrap(<TicketForm orders={orders} />);
    fill('other', '   ');
    fireEvent.click(screen.getByTestId('ticket-submit'));
    fill('order', 'Ma commande est bloquée');
    fireEvent.click(screen.getByTestId('ticket-submit'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie sujet, commande et message, puis ouvre le ticket créé', async () => {
    const fetchMock = mockFetch(() => json(201, { id: 'ticket-42' }));
    wrap(<TicketForm orders={orders} />);
    fill('order', 'Ma commande est bloquée');
    fireEvent.change(screen.getByTestId('ticket-order'), { target: { value: must(orders[0]).id } });
    fireEvent.click(screen.getByTestId('ticket-submit'));

    await waitFor(() => expect(nav.push).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(nav.push.mock.calls[0])).toContain('ticket-42');
    const [url, init] = must(fetchMock.mock.calls[0]);
    expect(String(url)).toBe('/api/v1/tickets');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      subject: 'order',
      order_id: must(orders[0]).id,
      body: 'Ma commande est bloquée',
    });
  });

  it('inclut les identifiants des captures déjà envoyées', async () => {
    const fetchMock = mockFetch((url) =>
      url.endsWith('/attachments') ? json(201, { id: 'att-9' }) : json(201, { id: 'ticket-1' }),
    );
    wrap(<TicketForm orders={[]} />);
    fireEvent.change(screen.getByTestId('ticket-attach'), { target: { files: [png()] } });
    await waitFor(() => expect(screen.getAllByTestId('attachment-chip')).toHaveLength(1));
    fill('other', 'Voici ma capture');
    fireEvent.click(screen.getByTestId('ticket-submit'));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const create = fetchMock.mock.calls.find(([u]) => String(u) === '/api/v1/tickets')!;
    expect(JSON.parse(String(create[1]?.body)).attachment_ids).toEqual(['att-9']);
  });

  it('affiche le message du serveur en cas de refus (limite) et ne change pas de page', async () => {
    mockFetch(() =>
      json(429, { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes.', request_id: 'r' } }),
    );
    wrap(<TicketForm orders={[]} />);
    fill('other', 'Bonjour');
    fireEvent.click(screen.getByTestId('ticket-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de requêtes.');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('annonce la réponse sous 24 h', () => {
    wrap(<TicketForm orders={[]} />);
    expect(document.body.textContent).toMatch(/24\s?h/);
  });
});

describe('TicketThread', () => {
  const ticket = {
    id: 'ticket-7',
    subject: 'other',
    status: 'open',
    order_short_id: null,
    created_at: '2026-11-12T10:00:00.000Z',
    updated_at: '2026-11-12T10:00:00.000Z',
  };
  const messages = [
    {
      id: 'm1',
      from_admin: false,
      body: '<b>Bonjour</b> & merci',
      attachments: [{ id: 'a1', url: 'https://x.test/signed/a1?token=t' }],
      created_at: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 'm2',
      from_admin: true,
      body: 'Nous regardons.',
      attachments: [],
      created_at: '2026-11-12T11:00:00.000Z',
    },
  ];

  it('montre les messages dans l’ordre, en distinguant client et équipe', () => {
    wrap(<TicketThread ticket={ticket} messages={messages} />);
    const rows = screen.getAllByTestId('ticket-message');
    expect(rows.map((r) => r.getAttribute('data-from-admin'))).toEqual(['false', 'true']);
    expect(rows[1]).toHaveTextContent('Nous regardons.');
  });

  it('affiche le texte brut tel quel : aucune balise HTML interprétée', () => {
    wrap(<TicketThread ticket={ticket} messages={messages} />);
    const first = must(screen.getAllByTestId('ticket-message')[0]);
    expect(first).toHaveTextContent('<b>Bonjour</b> & merci');
    expect(first.querySelector('b')).toBeNull();
  });

  it('affiche les captures avec l’adresse signée reçue', () => {
    wrap(<TicketThread ticket={ticket} messages={messages} />);
    const att = screen.getByTestId('ticket-attachment');
    expect(att.getAttribute('src') ?? att.getAttribute('href')).toBe(
      'https://x.test/signed/a1?token=t',
    );
  });

  it('répond au ticket (POST) puis rafraîchit', async () => {
    const fetchMock = mockFetch(() => json(201, { id: 'm3' }));
    wrap(<TicketThread ticket={ticket} messages={messages} />);
    fireEvent.change(screen.getByTestId('ticket-reply-body'), { target: { value: 'Merci !' } });
    fireEvent.click(screen.getByTestId('ticket-reply-send'));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    const [url, init] = must(fetchMock.mock.calls[0]);
    expect(String(url)).toBe('/api/v1/tickets/ticket-7/messages');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ body: 'Merci !' });
  });

  it('n’envoie pas une réponse vide', () => {
    const fetchMock = mockFetch(() => json(201, { id: 'm3' }));
    wrap(<TicketThread ticket={ticket} messages={messages} />);
    fireEvent.click(screen.getByTestId('ticket-reply-send'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ferme le ticket par PATCH {status: closed}', async () => {
    const fetchMock = mockFetch(() => json(200, { ticket: { ...ticket, status: 'closed' } }));
    wrap(<TicketThread ticket={ticket} messages={messages} />);
    fireEvent.click(screen.getByTestId('ticket-close'));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    const [url, init] = must(fetchMock.mock.calls[0]);
    expect(String(url)).toBe('/api/v1/tickets/ticket-7');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'closed' });
  });

  it('ticket fermé : pas de bouton fermer, une mention, et on peut encore écrire (réouverture)', () => {
    wrap(<TicketThread ticket={{ ...ticket, status: 'closed' }} messages={messages} />);
    expect(screen.queryByTestId('ticket-close')).toBeNull();
    expect(screen.getByTestId('ticket-closed-notice')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-reply-body')).toBeInTheDocument();
  });
});
