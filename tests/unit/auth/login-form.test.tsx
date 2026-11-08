// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fr from '@/messages/fr.json';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('next/script', () => ({ default: () => null }));

import { LoginForm } from '@/components/auth/login-form';

function renderForm() {
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

function fillAndSubmit() {
  const field = (name: string) =>
    document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  fireEvent.change(field('identifier'), { target: { value: '+237612345678' } });
  fireEvent.change(field('password'), { target: { value: 'secret-123' } });
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

function respond(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('formulaire de connexion', () => {
  beforeEach(() => push.mockClear());

  it('envoie le corps snake_case puis redirige vers le tableau de bord', async () => {
    respond(200, {});
    renderForm();
    fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/login');
    expect(JSON.parse(init.body as string)).toMatchObject({
      identifier: '+237612345678',
      password: 'secret-123',
    });
  });

  it('affiche le message du serveur tel quel dans une alerte', async () => {
    respond(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Identifiant incorrect.' } });
    renderForm();
    fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiant incorrect.');
    expect(push).not.toHaveBeenCalled();
  });

  it('affiche les erreurs champ par champ', async () => {
    respond(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalide.',
        details: { fields: { identifier: 'INVALID_IDENTIFIER' } },
      },
    });
    renderForm();
    fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('email ou un numéro');
  });
});
