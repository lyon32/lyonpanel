// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

describe('Card', () => {
  it('rend titre et contenu', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Solde</CardTitle>
        </CardHeader>
        <CardContent>5 000 XAF</CardContent>
      </Card>,
    );
    expect(screen.getByText('Solde')).toBeInTheDocument();
    expect(screen.getByText('5 000 XAF')).toBeInTheDocument();
  });

  it('fond blanc, bordure gris 200, arrondi 12 px (rounded-xl)', () => {
    render(<Card data-testid="carte">x</Card>);
    expect(screen.getByTestId('carte')).toHaveClass(
      'bg-blanc',
      'border',
      'border-gris-200',
      'rounded-xl',
    );
  });

  it('une seule ombre légère : jamais shadow-md/lg/xl/2xl', () => {
    render(<Card data-testid="carte">x</Card>);
    expect(screen.getByTestId('carte').className).not.toMatch(/shadow-(md|lg|xl|2xl)/);
  });

  it('CardTitle est un titre (heading) et accepte className', () => {
    render(<CardTitle className="extra">Titre</CardTitle>);
    expect(screen.getByRole('heading', { name: 'Titre' })).toHaveClass('extra');
  });

  it('Card fusionne className avec ses classes de base', () => {
    render(
      <Card data-testid="carte" className="mon-style">
        x
      </Card>,
    );
    expect(screen.getByTestId('carte')).toHaveClass('mon-style', 'bg-blanc');
  });
});
