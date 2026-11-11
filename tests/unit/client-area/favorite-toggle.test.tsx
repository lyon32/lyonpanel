// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '@/messages/fr.json';
import { FavoriteToggle } from '@/components/order/favorite-toggle';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

function renderToggle(initialFavorite: boolean) {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <FavoriteToggle serviceId={9001350} initialFavorite={initialFavorite} />
    </NextIntlClientProvider>,
  );
}

function mockFetch(status: number) {
  const fetchMock = vi.fn(async () =>
    status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'x' } }), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('FavoriteToggle', () => {
  it('état de départ venu du serveur : aria-pressed', () => {
    renderToggle(true);
    expect(screen.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('ajoute par PUT puis passe à pressé', async () => {
    const fetchMock = mockFetch(204);
    renderToggle(false);
    const button = screen.getByTestId('favorite-toggle');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/favorites/9001350');
    expect(init.method).toBe('PUT');
  });

  it('retire par DELETE', async () => {
    const fetchMock = mockFetch(204);
    renderToggle(true);
    const button = screen.getByTestId('favorite-toggle');
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('DELETE');
  });

  it('en cas d’échec, l’état ne change pas', async () => {
    const fetchMock = mockFetch(404);
    renderToggle(false);
    const button = screen.getByTestId('favorite-toggle');
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
