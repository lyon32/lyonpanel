import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/server/http/api-error';

const requireAdmin = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-admin', () => ({ requireAdmin: () => requireAdmin() }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));

describe('requireAdminPage', () => {
  it('renvoie l’administrateur quand le contrôle passe', async () => {
    requireAdmin.mockResolvedValueOnce({ id: 'a1' });
    const { requireAdminPage } = await import('@/server/admin/page-guard');
    await expect(requireAdminPage()).resolves.toEqual({ id: 'a1' });
  });

  it.each(['NOT_FOUND', 'MFA_REQUIRED'] as const)('%s donne une page 404', async (code) => {
    requireAdmin.mockRejectedValueOnce(new ApiError(code, 404));
    const { requireAdminPage } = await import('@/server/admin/page-guard');
    await expect(requireAdminPage()).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404'),
    });
  });

  it('laisse remonter une vraie panne', async () => {
    requireAdmin.mockRejectedValueOnce(new Error('boom'));
    const { requireAdminPage } = await import('@/server/admin/page-guard');
    await expect(requireAdminPage()).rejects.toThrow('boom');
  });
});
