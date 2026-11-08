// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '../../helpers/layout-intl';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);

import { SiteFooter } from '@/components/layout/site-footer';

describe('SiteFooter', () => {
  it.each(['Confidentialité', 'Conditions', 'Contact'])('affiche le lien %s', (name) => {
    renderIntl(<SiteFooter />);
    expect(screen.getByRole('link', { name })).toBeInTheDocument();
  });

  it('pointe vers les pages traduites (/fr/confidentialite, /fr/conditions)', () => {
    renderIntl(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute(
      'href',
      '/fr/confidentialite',
    );
    expect(screen.getByRole('link', { name: 'Conditions' })).toHaveAttribute(
      'href',
      '/fr/conditions',
    );
  });
});
