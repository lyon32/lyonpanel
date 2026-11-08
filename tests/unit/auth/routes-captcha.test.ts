import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

const { siteverify, signIn, sendReset, afterMock } = vi.hoisted(() => ({
  siteverify: vi.fn(async () => true),
  signIn: vi.fn(),
  sendReset: vi.fn(async () => {}),
  afterMock: vi.fn(),
}));
vi.mock('@/server/auth/turnstile', () => ({ verifyTurnstile: siteverify }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('@/server/auth/supabase-deps', async () => {
  const { createLoginLimiter, createRateLimiter } = await import('@/server/auth/rate-limit');
  const { memoryStore } = await import('../../helpers/memory-attempt-store');
  return {
    buildLoginDeps: () => ({
      limiter: createLoginLimiter({ store: memoryStore().store }),
      findEmailByPhone: async () => null,
      signIn,
    }),
    buildForgotDeps: () => ({
      rateLimiter: createRateLimiter({ store: memoryStore().store }),
      sendReset,
    }),
  };
});

import { apiError } from '@/server/http/api-error';
import { POST as forgot } from '@/app/api/v1/auth/password/forgot/route';
import { POST as login } from '@/app/api/v1/auth/login/route';

/**
 * Contrat : les routes login et forgot ne rappellent PAS siteverify (le jeton est à usage unique
 * et Supabase Auth le vérifie lui-même) ; le jeton est transmis à signIn / sendReset.
 */

function post(body: object) {
  return new NextRequest('http://localhost:3000/api/v1/auth/x', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  });
}

beforeEach(() => {
  siteverify.mockClear();
  signIn.mockReset().mockResolvedValue({ id: 'user-1' });
  sendReset.mockClear();
});

describe('POST /auth/login', () => {
  const body = {
    identifier: 'jean@lyonpanel.test',
    password: 'Un-bon-mot-de-passe-42',
    turnstile_token: 'tok-login',
  };

  it('transmet le jeton à signIn et ne rappelle pas siteverify', async () => {
    const res = await login(post(body));
    expect(res.status).toBe(200);
    expect(signIn).toHaveBeenCalledWith('jean@lyonpanel.test', body.password, 'tok-login');
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('captcha refusé par Supabase : 400 TURNSTILE_FAILED au format unique', async () => {
    signIn.mockImplementation(async () => apiError('TURNSTILE_FAILED'));
    const res = await login(post(body));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('TURNSTILE_FAILED');
    expect(error.request_id).toMatch(/^req_/);
  });

  it('jeton vide : refusé par la validation (400) sans appeler signIn', async () => {
    const res = await login(post({ ...body, turnstile_token: '' }));
    expect(res.status).toBe(400);
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe('POST /auth/password/forgot', () => {
  it('transmet le jeton à sendReset, répond ok et ne rappelle pas siteverify', async () => {
    const res = await forgot(post({ email: 'jean@lyonpanel.test', turnstile_token: 'tok-forgot' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendReset).toHaveBeenCalledWith('jean@lyonpanel.test', 'tok-forgot');
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('jeton vide : 400 sans envoi', async () => {
    const res = await forgot(post({ email: 'jean@lyonpanel.test', turnstile_token: '' }));
    expect(res.status).toBe(400);
    expect(sendReset).not.toHaveBeenCalled();
  });
});
