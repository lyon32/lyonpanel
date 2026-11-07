// @vitest-environment jsdom
// EmptyState : props { title, description?, action? } ; aucun texte en dur.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/shared/empty-state';

describe('EmptyState', () => {
  it('affiche le titre dans un heading', () => {
    render(<EmptyState title="Aucune commande" />);
    expect(screen.getByRole('heading', { name: 'Aucune commande' })).toBeInTheDocument();
  });

  it('affiche la description si fournie', () => {
    render(<EmptyState title="Vide" description="Passez votre première commande." />);
    expect(screen.getByText('Passez votre première commande.')).toBeInTheDocument();
  });

  it("n'affiche pas de description sans la prop", () => {
    const { container } = render(<EmptyState title="Vide" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it("affiche l'action fournie", () => {
    render(<EmptyState title="Vide" action={<button>Commander</button>} />);
    expect(screen.getByRole('button', { name: 'Commander' })).toBeInTheDocument();
  });
});
