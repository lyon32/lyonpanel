// @vitest-environment jsdom
// En mouvement réduit, aucune rotation continue ne doit rester : chaque animate-spin porte motion-reduce:animate-none.
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import SlideToConfirm from '@/components/motion/slide-to-confirm';
import { Button } from '@/components/ui/button';

function spinners(container: HTMLElement) {
  return [...container.querySelectorAll('.animate-spin')];
}

beforeAll(() => {
  // jsdom n'a pas ResizeObserver, utilisé par le curseur.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe('mouvement réduit : rotations continues', () => {
  it('le bouton en chargement coupe sa rotation', () => {
    const { container } = render(
      <Button loading loadingLabel="…">
        OK
      </Button>,
    );
    const found = spinners(container);
    expect(found.length).toBeGreaterThan(0);
    for (const el of found)
      expect(el.getAttribute('class')).toContain('motion-reduce:animate-none');
  });

  it('le curseur de confirmation coupe sa rotation', () => {
    const { container } = render(
      <SlideToConfirm label="a" confirmingLabel="b" doneLabel="c" onConfirm={async () => {}} />,
    );
    const found = spinners(container);
    expect(found.length).toBeGreaterThan(0);
    for (const el of found)
      expect(el.getAttribute('class')).toContain('motion-reduce:animate-none');
  });
});
