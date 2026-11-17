import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { memoryStore } from '../../helpers/memory-attempt-store';
import { registerUser, type RegisterDeps } from '@/server/auth/register';
import { createRateLimiter, hashIp } from '@/server/auth/rate-limit';

// Phase 11 : l'inscription garde l'empreinte HMAC de l'IP (indice « même IP » parrain/filleul), jamais l'IP.
const input = {
  email: 'ip-hash@lyonpanel.test',
  password: 'Cf9!vQ2#zLm7-rTa84',
  phone: '+237600000009',
  country: 'CM',
  display_currency: 'USD',
  language: 'fr',
  turnstile_token: 'tok',
} as const;

function makeDeps(setSignupIpHash: RegisterDeps['setSignupIpHash']): RegisterDeps {
  return {
    rateLimiter: createRateLimiter({ store: memoryStore().store }),
    verifyTurnstile: async () => true,
    createAuthUser: async () => ({ ok: true, userId: 'user-ip' }),
    setDisplayCurrency: async () => {},
    setSignupIpHash,
  };
}

describe('registerUser : empreinte de l’IP', () => {
  it('enregistre le HMAC de l’IP, jamais l’IP', async () => {
    const save = vi.fn<NonNullable<RegisterDeps['setSignupIpHash']>>(async () => {});
    await registerUser(input, '203.0.113.7', makeDeps(save));
    expect(save).toHaveBeenCalledWith('user-ip', hashIp('203.0.113.7'));
    expect(JSON.stringify(save.mock.calls)).not.toContain('203.0.113.7');
  });

  it('adresse inconnue : rien n’est enregistré', async () => {
    const save = vi.fn<NonNullable<RegisterDeps['setSignupIpHash']>>(async () => {});
    await registerUser(input, 'unknown', makeDeps(save));
    expect(save).not.toHaveBeenCalled();
  });

  it('une panne de l’enregistrement n’empêche pas l’inscription', async () => {
    const save = vi.fn<NonNullable<RegisterDeps['setSignupIpHash']>>(async () => {
      throw new Error('panne');
    });
    const result = await registerUser(input, '203.0.113.7', makeDeps(save));
    expect(result.user.id).toBe('user-ip');
  });
});
