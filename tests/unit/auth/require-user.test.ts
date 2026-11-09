import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getUser, getSession, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () => ({ auth: { getUser, getSession } }),
}));
vi.mock('next/navigation', () => ({ redirect }));

import { requireUser } from '@/server/auth/require-user';

/**
 * Contrat : requireUser(locale: 'fr' | 'en'): Promise<{ id: string; email: string | undefined }>
 *   - lit la session UNIQUEMENT par supabase.auth.getUser() (jamais getSession) ;
 *   - sans utilisateur valide (ou erreur) : redirect('/fr/connexion') ou redirect('/en/login') ;
 *   - le layout du groupe (app) l'appelle avant d'afficher quoi que ce soit.
 */

beforeEach(() => {
  getUser.mockReset();
  getSession.mockReset();
  redirect.mockClear();
});

describe('requireUser', () => {
  it("renvoie l'utilisateur quand la session est valide", async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' } }, error: null });
    await expect(requireUser('fr')).resolves.toMatchObject({ id: 'u1' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('déconnecté en français : redirige vers /fr/connexion', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser('fr')).rejects.toThrow('NEXT_REDIRECT:/fr/connexion');
  });

  it('déconnecté en anglais : redirige vers /en/login', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser('en')).rejects.toThrow('NEXT_REDIRECT:/en/login');
  });

  it('jeton refusé par Supabase (erreur) : redirige', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } });
    await expect(requireUser('fr')).rejects.toThrow('NEXT_REDIRECT:/fr/connexion');
  });

  it('getUser rejette (cookie de session révoquée) : redirige quand même, sans autre erreur', async () => {
    getUser.mockRejectedValue(new Error('Cookies can only be modified in a Server Action'));
    await expect(requireUser('fr')).rejects.toThrow('NEXT_REDIRECT:/fr/connexion');
    getUser.mockRejectedValue(new Error('AuthSessionMissingError'));
    await expect(requireUser('en')).rejects.toThrow('NEXT_REDIRECT:/en/login');
  });

  it("getUser renvoie une erreur avec un message d'écriture de cookie : redirige", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Cookies can only be modified in a Server Action or Route Handler' },
    });
    await expect(requireUser('en')).rejects.toThrow('NEXT_REDIRECT:/en/login');
  });

  it("n'utilise jamais getSession (le cookie seul ne prouve rien)", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'faux' } } } });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser('fr')).rejects.toThrow('NEXT_REDIRECT');
    expect(getSession).not.toHaveBeenCalled();
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});

describe('layout du groupe (app)', () => {
  it('appelle requireUser avec la langue de la page', () => {
    const src = readFileSync(
      join(process.cwd(), 'src', 'app', '[locale]', '(app)', 'layout.tsx'),
      'utf8',
    );
    expect(src).toMatch(/from '@\/server\/auth\/require-user'/);
    expect(src).toMatch(/await requireUser\(/);
    expect(src).toMatch(/params/);
  });
});
