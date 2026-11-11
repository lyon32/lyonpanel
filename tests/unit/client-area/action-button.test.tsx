// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionButton } from '@/components/shared/action-button';

/*
 * Composant attendu (plan 8.4) : src/components/shared/action-button.tsx
 *   ActionButton({ onAction: () => Promise<void>, label, loadingLabel, successLabel, ...props du Button })
 *   repos : affiche `label`, enabled
 *   clic  : appelle onAction UNE fois ; pendant l'attente : `loadingLabel`, aria-busy="true", désactivé
 *           (un second clic n'appelle pas onAction une seconde fois)
 *   fin OK : `successLabel` (désactivé) puis retour au repos au plus tard 600 ms plus tard
 *   échec  : retour direct au repos (jamais de libellé de succès), onAction non relancé tout seul
 */

type Handle = { promise: Promise<void>; resolve: () => void; reject: () => void };
function deferred(): Handle {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = () => rej(new Error('échec'));
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(handle: Handle) {
  const onAction = vi.fn(() => handle.promise);
  render(
    <ActionButton
      onAction={onAction}
      label="Enregistrer"
      loadingLabel="Enregistrement…"
      successLabel="Enregistré"
    />,
  );
  return { onAction, button: () => screen.getByRole('button') };
}

describe('ActionButton : états loading puis success', () => {
  it('au repos : libellé normal, actif, pas aria-busy', () => {
    const { button } = setup(deferred());
    expect(button()).toHaveTextContent('Enregistrer');
    expect(button()).toBeEnabled();
    expect(button()).not.toHaveAttribute('aria-busy');
  });

  it('pendant l attente : loading, aria-busy, désactivé', async () => {
    const { button, onAction } = setup(deferred());
    fireEvent.click(button());
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(button()).toHaveTextContent('Enregistrement…');
    expect(button()).toHaveAttribute('aria-busy', 'true');
    expect(button()).toBeDisabled();
  });

  it('un double clic n appelle l action qu une fois', async () => {
    const { button, onAction } = setup(deferred());
    fireEvent.click(button());
    fireEvent.click(button());
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('action réussie : affiche success puis revient au repos en 600 ms au plus', async () => {
    const h = deferred();
    const { button } = setup(h);
    fireEvent.click(button());
    await act(async () => {
      h.resolve();
      await h.promise;
    });
    expect(button()).toHaveTextContent('Enregistré');
    expect(button()).toBeDisabled();
    expect(button()).not.toHaveAttribute('aria-busy');
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(button()).toHaveTextContent('Enregistrer');
    expect(button()).toBeEnabled();
  });

  it('action en échec : retour au repos sans jamais afficher success', async () => {
    const h = deferred();
    const { button, onAction } = setup(h);
    fireEvent.click(button());
    await act(async () => {
      h.reject();
      await h.promise.catch(() => {});
    });
    expect(button()).toHaveTextContent('Enregistrer');
    expect(button()).not.toHaveTextContent('Enregistré');
    expect(button()).toBeEnabled();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
