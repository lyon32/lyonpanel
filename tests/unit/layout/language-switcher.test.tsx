// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '../../helpers/layout-intl';
import { navState, replaceSpy } from '../../helpers/mock-navigation';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);
import { LanguageSwitcher } from '@/components/layout/language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    replaceSpy.mockClear();
    navState.lastUrl = '';
  });

  it('garde la page équivalente : /fr/commander -> /en/order', async () => {
    navState.pathname = '/order';
    renderIntl(<LanguageSwitcher />, 'fr');
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(navState.lastUrl).toBe('/en/order');
  });

  it("garde la page dans l'autre sens : /en/add-funds -> /fr/recharger", async () => {
    navState.pathname = '/add-funds';
    renderIntl(<LanguageSwitcher />, 'en');
    await userEvent.click(screen.getByRole('button', { name: 'Français' }));
    expect(navState.lastUrl).toBe('/fr/recharger');
  });

  it('marque la langue active avec aria-current="true"', () => {
    navState.pathname = '/order';
    renderIntl(<LanguageSwitcher />, 'fr');
    expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'English' })).not.toHaveAttribute('aria-current');
  });
});
