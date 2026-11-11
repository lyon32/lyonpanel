// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '@/messages/fr.json';
import { SuggestionCard } from '@/components/order/suggestion-card';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);

/*
 * Composant attendu (plan 8.4) : src/components/order/suggestion-card.tsx
 *   SuggestionCard({ service: {id, name, platform}, quantity, onDisable: () => void | Promise<void> })
 *   data-testid="suggestion-card"     la carte
 *   data-testid="suggestion-order"    lien « Commander » vers /order?service=<id>&quantity=<quantité>
 *   data-testid="suggestion-dismiss"  croix : ferme la carte pour la session seulement (rien n'est mémorisé)
 *   data-testid="suggestion-disable"  « ne plus afficher » : appelle onDisable (qui enregistre en base via
 *                                     PATCH /me {suggestions_enabled:false}) et ferme la carte.
 * Le composant n'écrit RIEN dans le navigateur (ni localStorage ni sessionStorage).
 * Aucun coût, marge ni fournisseur n'est reçu ni affiché.
 */

const service = { id: 4242, name: 'Abonnés TikTok', platform: 'tiktok' };

const onDisable = vi.fn(async () => {});

function renderCard() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <SuggestionCard service={service} quantity={500} onDisable={onDisable} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  onDisable.mockClear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('SuggestionCard', () => {
  it('affiche le service et la quantité habituelle', () => {
    renderCard();
    const card = screen.getByTestId('suggestion-card');
    expect(card).toHaveTextContent('Abonnés TikTok');
    expect(card).toHaveTextContent('500');
  });

  it('le bouton Commander pré-remplit le formulaire (service et quantité dans l adresse)', () => {
    renderCard();
    const href = screen.getByTestId('suggestion-order').getAttribute('href') ?? '';
    expect(href).toContain('service=4242');
    expect(href).toContain('quantity=500');
  });

  it('la croix ferme la carte sans mémoriser de préférence', () => {
    renderCard();
    fireEvent.click(screen.getByTestId('suggestion-dismiss'));
    expect(screen.queryByTestId('suggestion-card')).toBeNull();
    expect(onDisable).not.toHaveBeenCalled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('la croix est une cible tactile accessible (nom accessible non vide, type button)', () => {
    renderCard();
    const close = screen.getByTestId('suggestion-dismiss');
    expect(close.tagName).toBe('BUTTON');
    expect(close).toHaveAttribute('type', 'button');
    expect(close.getAttribute('aria-label') ?? close.textContent).toBeTruthy();
  });

  it('« ne plus afficher » appelle onDisable une fois, ferme la carte et n écrit rien dans le navigateur', async () => {
    renderCard();
    fireEvent.click(screen.getByTestId('suggestion-disable'));
    await waitFor(() => expect(screen.queryByTestId('suggestion-card')).toBeNull());
    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('un nouveau rendu réaffiche la carte (la préférence vient du serveur, pas du navigateur)', () => {
    const first = renderCard();
    fireEvent.click(screen.getByTestId('suggestion-dismiss'));
    first.unmount();
    renderCard();
    expect(screen.getByTestId('suggestion-card')).toBeInTheDocument();
  });

  it('n affiche aucun mot fournisseur, coût ou marge', () => {
    renderCard();
    const text = (screen.getByTestId('suggestion-card').textContent ?? '').toLowerCase();
    for (const word of ['fournisseur', 'provider', 'coût', 'marge', 'cost', 'margin']) {
      expect(text).not.toContain(word);
    }
  });
});
