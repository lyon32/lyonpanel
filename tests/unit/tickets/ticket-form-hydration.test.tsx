// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import fr from '@/messages/fr.json';
import { TicketForm } from '@/components/tickets/ticket-form';

// Bug corrigé : sur un téléphone lent, le sujet choisi avant l'hydratation était effacé par React.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

describe('formulaire de ticket avant hydratation (rendu serveur)', () => {
  const html = renderToString(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <TicketForm orders={[]} />
    </NextIntlClientProvider>,
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');

  it('le sujet est désactivé', () => {
    expect(doc.querySelector('[data-testid="ticket-subject"]')?.hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('le message est désactivé', () => {
    expect(doc.querySelector('[data-testid="ticket-body"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('le bouton Envoyer est désactivé', () => {
    expect(doc.querySelector('[data-testid="ticket-submit"]')?.hasAttribute('disabled')).toBe(true);
  });
});
