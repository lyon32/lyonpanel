// @vitest-environment jsdom
// Reveal({ children, className? }) : src/components/motion/reveal.tsx. Niveau lu via useMotionLevel (mocké).
// Un enfant portant data-no-motion (prix, solde) n'est jamais animé : transform vide, opacité non nulle.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const level = vi.hoisted(() => ({ current: 'rich' as 'none' | 'light' | 'rich' }));
vi.mock('@/hooks/use-motion-level', () => ({ useMotionLevel: () => level.current }));

import { Reveal } from '@/components/motion/reveal';

describe('Reveal', () => {
  beforeEach(() => {
    level.current = 'rich';
  });

  it.each(['none', 'light', 'rich'] as const)('rend ses enfants au niveau %s', (l) => {
    level.current = l;
    render(
      <Reveal>
        <p>Bonjour</p>
      </Reveal>,
    );
    expect(screen.getByText('Bonjour')).toBeTruthy();
  });

  it('n’applique aucune transformation ni opacité masquante au niveau none', () => {
    level.current = 'none';
    const { container } = render(
      <Reveal>
        <p>Texte</p>
      </Reveal>,
    );
    for (const el of container.querySelectorAll<HTMLElement>('*')) {
      expect(el.style.transform).toBe('');
      expect(el.style.opacity === '' || el.style.opacity === '1').toBe(true);
    }
  });

  it('n’anime jamais un enfant data-no-motion (solde)', () => {
    render(
      <Reveal>
        <span data-no-motion data-testid="solde">
          12 500 XAF
        </span>
      </Reveal>,
    );
    const solde = screen.getByTestId('solde');
    expect(solde.style.transform).toBe('');
    expect(solde.style.opacity === '' || solde.style.opacity === '1').toBe(true);
    expect(solde.textContent).toBe('12 500 XAF');
  });

  it('garde le prix visible pour data-no-motion en niveau light', () => {
    level.current = 'light';
    render(
      <Reveal>
        <strong data-no-motion data-testid="prix">
          500 XAF
        </strong>
      </Reveal>,
    );
    const prix = screen.getByTestId('prix');
    expect(prix.style.transform).toBe('');
    expect(prix.style.opacity).not.toBe('0');
  });

  it('transmet className au conteneur', () => {
    const { container } = render(
      <Reveal className="mon-bloc">
        <p>x</p>
      </Reveal>,
    );
    expect(container.querySelector('.mon-bloc')).not.toBeNull();
  });
});
