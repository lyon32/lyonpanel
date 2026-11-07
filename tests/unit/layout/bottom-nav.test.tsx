// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '../../helpers/layout-intl';
import { navState } from '../../helpers/mock-navigation';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);
import { BottomNav } from '@/components/layout/bottom-nav';

describe('BottomNav', () => {
  beforeEach(() => {
    navState.pathname = '/add-funds';
  });

  it('a exactement 4 entrées : Commander, Commandes, Recharger, Compte', () => {
    renderIntl(<BottomNav />);
    const links = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Commander',
      'Commandes',
      'Recharger',
      'Compte',
    ]);
  });

  it('est masquée à partir de md (classe md:hidden)', () => {
    renderIntl(<BottomNav />);
    expect(screen.getByRole('navigation')).toHaveClass('md:hidden');
  });

  it('marque l\'entrée active avec aria-current="page"', () => {
    renderIntl(<BottomNav />);
    expect(screen.getByRole('link', { name: 'Recharger' })).toHaveAttribute('aria-current', 'page');
  });
});
