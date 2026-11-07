// @vitest-environment jsdom
// Badge : prop `status` = 'success' | 'pending' | 'failed' | 'info', ou `variant="popular"`.
// Classes sémantiques (docs/05 §1, Statuts) :
//   success -> bg-succes-fond text-succes   (#ECFDF3 / #067647)
//   pending -> bg-jaune-50 text-jaune-700   (#FDF7EA / #A87A22)
//   failed  -> bg-erreur-fond text-erreur   (#FEF3F2 / #B42318)
//   info    -> bg-bleu-50 text-bleu-600     (#EFF4FF / #1D4ED8)
//   popular -> bg-jaune-50 text-jaune-700 (jamais jaune 500 en texte)
// Jetons à ajouter dans globals.css : --color-succes-fond #ECFDF3, --color-erreur-fond #FEF3F2.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it.each([
    ['success', ['bg-succes-fond', 'text-succes']],
    ['pending', ['bg-jaune-50', 'text-jaune-700']],
    ['failed', ['bg-erreur-fond', 'text-erreur']],
    ['info', ['bg-bleu-50', 'text-bleu-600']],
  ] as const)('statut %s : bonnes couleurs', (status, classes) => {
    render(<Badge status={status}>Libellé</Badge>);
    expect(screen.getByText('Libellé')).toHaveClass(...classes);
  });

  it('variante popular : fond jaune 50, texte jaune 700 (pas jaune 500)', () => {
    render(<Badge variant="popular">Populaire</Badge>);
    const b = screen.getByText('Populaire');
    expect(b).toHaveClass('bg-jaune-50', 'text-jaune-700');
    expect(b.className).not.toMatch(/text-jaune-500/);
  });

  it('est une pilule (rounded-full)', () => {
    render(<Badge status="info">Info</Badge>);
    expect(screen.getByText('Info')).toHaveClass('rounded-full');
  });
});
