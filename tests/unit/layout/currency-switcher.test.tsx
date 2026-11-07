// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '../../helpers/layout-intl';

vi.mock('@/i18n/navigation', async () =>
  (await import('../../helpers/mock-navigation')).buildNavigationMock(),
);
import { CurrencySwitcher } from '@/components/layout/currency-switcher';

describe('CurrencySwitcher', () => {
  it('propose 3 devises : XAF, XOF, USD', () => {
    renderIntl(<CurrencySwitcher value="XAF" setCurrencyCookie={vi.fn()} />);
    const box = screen.getByRole('combobox', { name: 'Devise' });
    expect(
      within(box)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['XAF', 'XOF', 'USD']);
  });

  it('affiche la devise courante', () => {
    renderIntl(<CurrencySwitcher value="XOF" setCurrencyCookie={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Devise' })).toHaveValue('XOF');
  });

  it('au choix, appelle setCurrencyCookie avec la devise choisie', async () => {
    const setCurrencyCookie = vi.fn();
    renderIntl(<CurrencySwitcher value="XAF" setCurrencyCookie={setCurrencyCookie} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Devise' }), 'USD');
    expect(setCurrencyCookie).toHaveBeenCalledTimes(1);
    expect(setCurrencyCookie).toHaveBeenCalledWith('USD');
  });
});
