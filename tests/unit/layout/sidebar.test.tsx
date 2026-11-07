// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '../../helpers/layout-intl';
import { navState } from '../../helpers/mock-navigation';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);
import { Sidebar } from '@/components/layout/sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    navState.pathname = '/orders';
  });

  it.each(['Commandes', 'Services', 'Recharger', 'Parrainage', 'Support', 'Compte'])(
    "affiche l'entrée %s",
    (name) => {
      renderIntl(<Sidebar />);
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    },
  );

  it('« Nouvelle commande » est le bouton principal (fond bleu)', () => {
    renderIntl(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Nouvelle commande' })).toHaveClass(
      'bg-bleu-600',
      'text-blanc',
    );
  });

  it('marque le lien actif avec aria-current="page", et lui seul', () => {
    renderIntl(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Commandes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Recharger' })).not.toHaveAttribute('aria-current');
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('change le lien actif selon la page (/add-funds)', () => {
    navState.pathname = '/add-funds';
    renderIntl(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Recharger' })).toHaveAttribute('aria-current', 'page');
  });
});
