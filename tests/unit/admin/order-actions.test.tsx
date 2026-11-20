// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderActions } from '@/components/admin/order-actions';
import en from '@/messages/admin.en.json';
import fr from '@/messages/admin.fr.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const base = {
  orderId: '11111111-1111-4111-8111-111111111111',
  status: 'to_review',
  customer: 'ana@example.com',
  locale: 'fr',
  maxRefundXaf: 5000,
  suggestedRefundXaf: 2000 as number | null,
  resent: false,
};

function show(props: Partial<typeof base> = {}, lang: 'fr' | 'en' = 'fr') {
  return render(
    <NextIntlClientProvider locale={lang} messages={lang === 'fr' ? fr : en}>
      <OrderActions {...base} {...props} />
    </NextIntlClientProvider>,
  );
}

// Réponse en attente : permet de cliquer deux fois pendant l'envoi.
function pendingFetch() {
  let release: (r: Response) => void = () => undefined;
  const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    release: (status: number, body: unknown) => release(Response.json(body, { status })),
  };
}

const fill = (label: RegExp, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[index]!, { target: { value } });

afterEach(() => vi.unstubAllGlobals());

describe('fiche commande admin : remboursement', () => {
  it('propose la part non livrée et demande un motif', () => {
    show();
    expect(screen.getByLabelText(/Montant à rendre/)).toHaveValue('2000');
    expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  });

  it('montant libre quand le reste est inconnu : vide, avec le plafond affiché', () => {
    show({ suggestedRefundXaf: null });
    expect(screen.getByLabelText(/Montant à rendre/)).toHaveValue('');
    expect(screen.getByText(/au plus 5\s000 XAF/)).toBeInTheDocument();
  });

  it('refuse un montant au-dessus du plafond', () => {
    show();
    fill(/Montant à rendre/, '5001');
    fill(/Motif/, 'client remboursé');
    expect(screen.getByRole('button', { name: 'Rembourser' })).toBeDisabled();
  });

  it('récapitulatif puis un seul envoi avec Idempotency-Key, même après un double clic', async () => {
    const { fetchMock, release } = pendingFetch();
    show();
    fill(/Motif/, 'part non livrée');
    fireEvent.click(screen.getByRole('button', { name: 'Rembourser' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /2\s000 XAF rendus sur le solde de ana@example\.com/,
    );
    const confirm = screen.getByRole('button', { name: 'Oui, rembourser' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/v1/admin/orders/${base.orderId}/refund`);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body as string)).toEqual({
      amount_xaf: 2000,
      reason: 'part non livrée',
    });
    release(200, { refunded_xaf: 2000 });
    await waitFor(() => expect(screen.getByText('Remboursement fait.')).toBeInTheDocument());
  });

  it('affiche le message de l’API en cas d’erreur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: 'AMOUNT_TOO_HIGH',
              message: 'Le montant dépasse celui qui a été débité.',
            },
          },
          { status: 422 },
        ),
      ),
    );
    show();
    fill(/Motif/, 'test');
    fireEvent.click(screen.getByRole('button', { name: 'Rembourser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oui, rembourser' }));
    await waitFor(() => expect(screen.getByText(/dépasse celui/)).toBeInTheDocument());
  });

  it('plus rien à rembourser : pas de formulaire', () => {
    show({ maxRefundXaf: 0 });
    expect(screen.getByText(/Plus rien à rembourser/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Montant à rendre/)).toBeNull();
  });
});

describe('fiche commande admin : autres actions', () => {
  it('renvoi : bloqué tant que la case de vérification n’est pas cochée', () => {
    show();
    fill(/Motif/, 'rien reçu', 1);
    const button = screen.getByRole('button', { name: 'Renvoyer la commande' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/J'ai vérifié chez le fournisseur/));
    expect(button).toBeEnabled();
  });

  it('renvoi déjà fait : plus de bouton, une seule fois', () => {
    show({ resent: true });
    expect(screen.queryByRole('button', { name: 'Renvoyer la commande' })).toBeNull();
    expect(screen.getByText(/Déjà renvoyée une fois/)).toBeInTheDocument();
  });

  it('commande en cours : annulation proposée, pas la clôture ni le renvoi', () => {
    show({ status: 'in_progress' });
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clôturer la commande' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Renvoyer la commande' })).toBeNull();
  });

  it('clôture : envoie le motif à /close après confirmation', async () => {
    const fetchMock = vi.fn(async () => Response.json({ order_status: 'completed' }));
    vi.stubGlobal('fetch', fetchMock);
    show();
    fill(/Motif/, 'livrée chez le fournisseur', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Clôturer la commande' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la clôture' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/v1/admin/orders/${base.orderId}/close`);
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'livrée chez le fournisseur' });
  });

  it('version anglaise', () => {
    show({}, 'en');
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
  });
});
