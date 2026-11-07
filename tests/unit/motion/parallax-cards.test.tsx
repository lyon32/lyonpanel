// @vitest-environment jsdom
// FloatingCards({ cards, className? }) : src/components/motion/floating-cards.tsx
//   cards: { id: string; content: ReactNode }[] ; chaque carte rendue porte l'attribut data-floating-card.
//   light : 3 cartes max, aucun écouteur mousemove ; rich : toutes ; none : toutes, statiques (pas de transform).
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const level = vi.hoisted(() => ({ current: 'rich' as 'none' | 'light' | 'rich' }));
vi.mock('@/hooks/use-motion-level', () => ({ useMotionLevel: () => level.current }));

import { FloatingCards } from '@/components/motion/floating-cards';

const cards = Array.from({ length: 6 }, (_, i) => ({
  id: `c${i}`,
  content: <span>Carte {i}</span>,
}));
const count = (c: HTMLElement) => c.querySelectorAll('[data-floating-card]').length;

describe('FloatingCards', () => {
  beforeEach(() => {
    level.current = 'rich';
  });
  afterEach(() => vi.restoreAllMocks());

  it('rend toutes les cartes en rich', () => {
    const { container } = render(<FloatingCards cards={cards} />);
    expect(count(container)).toBe(6);
  });

  it('rend au plus 3 cartes en light', () => {
    level.current = 'light';
    const { container } = render(<FloatingCards cards={cards} />);
    expect(count(container)).toBe(3);
  });

  it('rend toutes les cartes en none, sans transformation', () => {
    level.current = 'none';
    const { container } = render(<FloatingCards cards={cards} />);
    expect(count(container)).toBe(6);
    container.querySelectorAll<HTMLElement>('[data-floating-card]').forEach((el) => {
      expect(el.style.transform).toBe('');
    });
  });

  it('rend 2 cartes en light quand il n’y en a que 2', () => {
    level.current = 'light';
    const { container } = render(<FloatingCards cards={cards.slice(0, 2)} />);
    expect(count(container)).toBe(2);
  });

  // React 19 enregistre lui-même ses événements sur le conteneur racine : on l'ignore.
  const mousemoveListeners = (level_: 'none' | 'light') => {
    level.current = level_;
    const w = vi.spyOn(window, 'addEventListener');
    const d = vi.spyOn(document, 'addEventListener');
    const e = vi.spyOn(Element.prototype, 'addEventListener');
    const { container } = render(<FloatingCards cards={cards} />);
    const onWindowOrDoc = [...w.mock.calls, ...d.mock.calls].filter((c) => c[0] === 'mousemove');
    const onElements = e.mock.calls.filter(
      (c, i) => c[0] === 'mousemove' && (e.mock.contexts[i] as Node) !== container,
    );
    return onWindowOrDoc.length + onElements.length;
  };

  it('n’ajoute aucun écouteur mousemove en light', () => {
    expect(mousemoveListeners('light')).toBe(0);
  });

  it('n’ajoute aucun écouteur mousemove en none', () => {
    expect(mousemoveListeners('none')).toBe(0);
  });
});
