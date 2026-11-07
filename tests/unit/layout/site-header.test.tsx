// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '../../helpers/layout-intl';
import { navState } from '../../helpers/mock-navigation';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);

import { SiteHeader } from '@/components/layout/site-header';

describe('SiteHeader', () => {
  beforeEach(() => {
    navState.pathname = '/';
  });
  const setup = () => renderIntl(<SiteHeader currency="XAF" setCurrencyCookie={vi.fn()} />);

  it.each(['Accueil', 'Services', 'Blog', 'Connexion', 'Inscription'])(
    'affiche le lien %s',
    (name) => {
      setup();
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    },
  );

  it('contient le choix de langue et le choix de devise', () => {
    setup();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Devise' })).toBeInTheDocument();
  });
});
