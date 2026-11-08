// @vitest-environment jsdom
// TableCell et TableHead : prop `numeric` -> classes `text-right tabular-nums`.
// TableHead : fond gris 50.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function sample() {
  return render(
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead numeric>Prix</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Abonnés</TableCell>
          <TableCell numeric>1 500</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe('Table', () => {
  it('rend un vrai tableau accessible', () => {
    sample();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Service' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Abonnés' })).toBeInTheDocument();
  });

  it('cellule numeric : à droite, chiffres tabulaires', () => {
    sample();
    expect(screen.getByRole('cell', { name: '1 500' })).toHaveClass('text-right', 'tabular-nums');
  });

  it('cellule normale : ni à droite ni tabulaire', () => {
    sample();
    const c = screen.getByRole('cell', { name: 'Abonnés' });
    expect(c).not.toHaveClass('text-right');
    expect(c).not.toHaveClass('tabular-nums');
  });

  it('en-tête numeric aligné à droite', () => {
    sample();
    expect(screen.getByRole('columnheader', { name: 'Prix' })).toHaveClass('text-right');
  });

  it('en-tête : fond gris 50', () => {
    sample();
    expect(screen.getByRole('columnheader', { name: 'Service' })).toHaveClass('bg-gris-50');
  });

  it('TableRow transmet className', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="l" className="ma-ligne">
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByTestId('l')).toHaveClass('ma-ligne');
  });
});
