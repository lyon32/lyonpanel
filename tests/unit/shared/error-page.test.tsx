// @vitest-environment jsdom
// src/app/[locale]/error.tsx : export default ({ error, reset }). Clés : error.title, error.description, error.retry.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from '@/app/[locale]/error';

const messages = {
  error: {
    title: 'Un problème est survenu',
    description: 'Réessayez dans un instant.',
    retry: 'Réessayer',
  },
};

function setup(reset = vi.fn()) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ErrorPage error={new Error('boom')} reset={reset} />
    </NextIntlClientProvider>,
  );
  return reset;
}

describe('error.tsx', () => {
  it("affiche l'ErrorState traduit (role alert)", () => {
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Un problème est survenu');
    expect(screen.getByText('Réessayez dans un instant.')).toBeInTheDocument();
  });

  it('« Réessayer » appelle reset', async () => {
    const reset = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("n'affiche pas le message technique de l'erreur", () => {
    setup();
    expect(screen.queryByText(/boom/)).toBeNull();
  });
});
