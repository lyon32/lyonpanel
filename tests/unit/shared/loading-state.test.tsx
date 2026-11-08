// @vitest-environment jsdom
// LoadingState : props { label } ; role="status", squelettes aria-hidden.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from '@/components/shared/loading-state';

describe('LoadingState', () => {
  it('expose role="status" avec le libellé accessible', () => {
    render(<LoadingState label="Chargement des services" />);
    expect(screen.getByRole('status', { name: 'Chargement des services' })).toBeInTheDocument();
  });

  it("cache les squelettes aux lecteurs d'écran (aria-hidden)", () => {
    const { container } = render(<LoadingState label="Chargement" />);
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });
});
