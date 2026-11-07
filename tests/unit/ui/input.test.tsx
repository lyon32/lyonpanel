// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('fond blanc, bordure gris 200, arrondi 8 px', () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveClass(
      'bg-blanc',
      'border-gris-200',
      'rounded-lg',
    );
  });

  it('focus : bordure bleu 600', () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole('textbox').className).toMatch(/focus-visible:border-bleu-600/);
  });

  it('hauteur minimale de 44 px', () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole('textbox')).toHaveClass('min-h-11');
  });

  it('transmet type, placeholder et la saisie', async () => {
    render(<Input aria-label="Email" placeholder="vous@exemple.com" />);
    const i = screen.getByRole('textbox');
    expect(i).toHaveAttribute('placeholder', 'vous@exemple.com');
    await userEvent.type(i, 'a@b.cm');
    expect(i).toHaveValue('a@b.cm');
  });

  it('aria-invalid : bordure d’erreur', () => {
    render(<Input aria-label="Email" aria-invalid />);
    expect(screen.getByRole('textbox').className).toMatch(/aria-invalid:border-erreur/);
  });
});
