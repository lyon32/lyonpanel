// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('par défaut : variante primary (fond bleu 600, texte blanc)', () => {
    render(<Button>Commander</Button>);
    expect(screen.getByRole('button', { name: 'Commander' })).toHaveClass(
      'bg-bleu-600',
      'text-blanc',
    );
  });

  it.each([
    ['secondary', ['bg-blanc', 'border', 'border-gris-200', 'text-encre']],
    ['ghost', ['bg-transparent', 'text-bleu-600']],
    ['destructive', ['bg-erreur', 'text-blanc']],
  ] as const)('variante %s : classes attendues', (variant, classes) => {
    render(<Button variant={variant}>Action</Button>);
    expect(screen.getByRole('button')).toHaveClass(...classes);
  });

  it('a une hauteur minimale de 44 px (min-h-11)', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });

  it('a un anneau de focus visible', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button').className).toMatch(/focus-visible:ring/);
  });

  it('loading : désactivé et affiche loadingLabel à la place du libellé', () => {
    render(
      <Button loading loadingLabel="Chargement…">
        Payer
      </Button>,
    );
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveTextContent('Chargement…');
    expect(b).not.toHaveTextContent('Payer');
  });

  it('loading : onClick n’est pas appelé', async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Chargement…" onClick={onClick}>
        Payer
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('appelle onClick au clic hors chargement', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Payer</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled : désactivé', () => {
    render(<Button disabled>Payer</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
