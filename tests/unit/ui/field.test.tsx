// @vitest-environment jsdom
// Field : <Field label="..." hint? error? {...propsInput} /> rend Label + Input + aide/erreur.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from '@/components/ui/field';

describe('Field', () => {
  it('lie le libellé au champ', () => {
    render(<Field label="Adresse email" />);
    expect(screen.getByLabelText('Adresse email')).toBeInstanceOf(HTMLInputElement);
  });

  it('aide reliée au champ via aria-describedby', () => {
    render(<Field label="Téléphone" hint="Format +237…" />);
    const input = screen.getByLabelText('Téléphone');
    const hint = screen.getByText('Format +237…');
    expect(hint.id).not.toBe('');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('erreur : role=alert, aria-invalid, aria-describedby vers l’erreur, texte rouge', () => {
    render(<Field label="Email" error="Email invalide" />);
    const input = screen.getByLabelText('Email');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Email invalide');
    expect(alert.className).toMatch(/text-erreur/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('sans erreur : pas de role=alert', () => {
    render(<Field label="Email" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('libellé placé avant le champ', () => {
    render(<Field label="Email" />);
    const label = screen.getByText('Email');
    const input = screen.getByLabelText('Email');
    expect(label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('deux champs ont des identifiants distincts', () => {
    render(
      <>
        <Field label="A" />
        <Field label="B" />
      </>,
    );
    expect(screen.getByLabelText('A').id).not.toBe(screen.getByLabelText('B').id);
  });

  it('transmet les props du champ (type, name)', () => {
    render(<Field label="Mot de passe" type="password" name="password" />);
    const i = screen.getByLabelText('Mot de passe');
    expect(i).toHaveAttribute('type', 'password');
    expect(i).toHaveAttribute('name', 'password');
  });
});
