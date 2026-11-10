// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { useOrderPolling } from '@/hooks/use-order-polling';

/*
 * Hook attendu (plan 7.4), src/hooks/use-order-polling.ts :
 *   useOrderPolling(isFinal: boolean): void
 *   - toutes les 30 s : router.refresh() (les statuts sont lus côté serveur) ;
 *   - rien quand l onglet est caché (document.hidden / visibilityState) ;
 *   - arrêt définitif quand isFinal vaut true (completed / to_review).
 */

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
  setHidden(false);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useOrderPolling', () => {
  it('n appelle rien avant 30 s', () => {
    renderHook(() => useOrderPolling(false));
    vi.advanceTimersByTime(29_999);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('un appel toutes les 30 s', () => {
    renderHook(() => useOrderPolling(false));
    vi.advanceTimersByTime(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('pause quand l onglet est caché, reprend quand il redevient visible', () => {
    renderHook(() => useOrderPolling(false));
    setHidden(true);
    vi.advanceTimersByTime(120_000);
    expect(refresh).not.toHaveBeenCalled();
    setHidden(false);
    vi.advanceTimersByTime(30_000);
    expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('ne démarre jamais si la commande est déjà terminée', () => {
    renderHook(() => useOrderPolling(true));
    vi.advanceTimersByTime(300_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('s arrête dès que la commande devient terminée', () => {
    const { rerender } = renderHook(({ done }) => useOrderPolling(done), {
      initialProps: { done: false },
    });
    vi.advanceTimersByTime(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ done: true });
    vi.advanceTimersByTime(300_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('s arrête au démontage (aucune fuite de minuteur)', () => {
    const { unmount } = renderHook(() => useOrderPolling(false));
    unmount();
    vi.advanceTimersByTime(300_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
