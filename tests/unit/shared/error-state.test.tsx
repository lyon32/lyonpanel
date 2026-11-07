// @vitest-environment jsdom
// ErrorState : props { title, description?, retryLabel, onRetry } ; role="alert".
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from '@/components/shared/error-state';

describe('ErrorState', () => {
  it('expose role="alert" avec le titre', () => {
    render(<ErrorState title="Chargement impossible" retryLabel="Réessayer" onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Chargement impossible');
  });

  it('affiche la description si fournie', () => {
    render(
      <ErrorState
        title="T"
        description="Vérifiez votre connexion."
        retryLabel="R"
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText('Vérifiez votre connexion.')).toBeInTheDocument();
  });

  it('appelle onRetry une fois au clic sur le bouton', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="T" retryLabel="Réessayer" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
