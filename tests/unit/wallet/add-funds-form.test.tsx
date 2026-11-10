// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { AddFundsForm } from '@/components/wallet/add-funds-form';

// Bornes passées en props par la page serveur (lues dans settings), jamais en dur dans le formulaire.
const MIN = 500;
const MAX = 500000;
const DEBOUNCE_WAIT_MS = 700;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ amount_xaf: 3000, fee_xaf: 90, total_to_pay: 3090 }), {
      status: 200,
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderForm(locale: 'fr' | 'en' = 'fr', min = MIN, max = MAX) {
  const messages = locale === 'fr' ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AddFundsForm minXaf={min} maxXaf={max} />
    </NextIntlClientProvider>,
  );
}

const input = () => screen.getByTestId('amount-input') as HTMLInputElement;
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const pay = () => fireEvent.click(screen.getByTestId('pay-submit'));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AddFundsForm : validation avant tout appel réseau', () => {
  it('affiche le minimum précis en français sous le minimum (499)', async () => {
    renderForm('fr');
    type('499');
    expect(await screen.findByText(/Le montant minimum est de 500 XAF/)).toBeInTheDocument();
  });

  it('affiche le minimum précis en anglais sous le minimum (499)', async () => {
    renderForm('en');
    type('499');
    expect(await screen.findByText(/minimum amount is 500 XAF/i)).toBeInTheDocument();
  });

  it('affiche le maximum précis en français au-dessus du maximum (500 001)', async () => {
    renderForm('fr');
    type('500001');
    expect(
      await screen.findByText(/Le montant maximum est de 500\D{1,2}000 XAF/),
    ).toBeInTheDocument();
  });

  it('affiche le maximum précis en anglais au-dessus du maximum (500 001)', async () => {
    renderForm('en');
    type('500001');
    expect(await screen.findByText(/maximum amount is 500\D?000 XAF/i)).toBeInTheDocument();
  });

  it('utilise les bornes reçues en props, pas des valeurs en dur', async () => {
    renderForm('fr', 1000, 200000);
    type('999');
    expect(
      await screen.findByText(/Le montant minimum est de 1\D{0,2}000 XAF/),
    ).toBeInTheDocument();
    type('200001');
    expect(
      await screen.findByText(/Le montant maximum est de 200\D{1,2}000 XAF/),
    ).toBeInTheDocument();
  });

  it('n appelle ni le devis ni le paiement pour 499 et 500 001, même après clic sur Payer', async () => {
    renderForm('fr');
    type('499');
    await wait(DEBOUNCE_WAIT_MS);
    pay();
    type('500001');
    await wait(DEBOUNCE_WAIT_MS);
    pay();
    await wait(50);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('champ vide + Payer : message « Entrez un montant » et aucun appel réseau', async () => {
    renderForm('fr');
    pay();
    expect(await screen.findByText(/Entrez un montant/)).toBeInTheDocument();
    await wait(50);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('champ vide + Payer en anglais : message « Enter an amount »', async () => {
    renderForm('en');
    pay();
    expect(await screen.findByText(/Enter an amount/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('texte non numérique + Payer : message « Entrez un montant » et aucun appel réseau', async () => {
    renderForm('fr');
    type('abc');
    pay();
    expect(await screen.findByText(/Entrez un montant/)).toBeInTheDocument();
    await wait(DEBOUNCE_WAIT_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retire « Calcul du total… » dès qu une erreur est affichée', async () => {
    renderForm('fr');
    type('499');
    expect(await screen.findByText(/Le montant minimum/)).toBeInTheDocument();
    expect(screen.queryByText(/Calcul du total/)).not.toBeInTheDocument();
    type('');
    pay();
    expect(await screen.findByText(/Entrez un montant/)).toBeInTheDocument();
    expect(screen.queryByText(/Calcul du total/)).not.toBeInTheDocument();
  });

  it('un montant valide (3 000) appelle toujours le devis (le serveur reste la source de vérité)', async () => {
    renderForm('fr');
    type('3000');
    await wait(DEBOUNCE_WAIT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/payments/quote');
  });

  it('accepte exactement les bornes (500 et 500 000) en appelant le devis', async () => {
    renderForm('fr');
    type('500');
    await wait(DEBOUNCE_WAIT_MS);
    type('500000');
    await wait(DEBOUNCE_WAIT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('messages wallet : clés identiques FR/EN', () => {
  it.each(['minAmount', 'maxAmount', 'enterAmount'])(
    'la clé wallet.%s existe en FR et EN',
    (key) => {
      const frWallet = fr.wallet as Record<string, string>;
      const enWallet = en.wallet as Record<string, string>;
      expect(frWallet[key]).toBeTruthy();
      expect(enWallet[key]).toBeTruthy();
    },
  );

  it('minAmount et maxAmount utilisent le paramètre {min} / {max}', () => {
    const w = fr.wallet as Record<string, string>;
    const e = en.wallet as Record<string, string>;
    expect(w.minAmount).toContain('{min}');
    expect(e.minAmount).toContain('{min}');
    expect(w.maxAmount).toContain('{max}');
    expect(e.maxAmount).toContain('{max}');
  });
});
