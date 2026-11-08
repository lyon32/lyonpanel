import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

// Routes d'authentification : la validation Zod se fait AVANT tout accès à Supabase.
const ROUTES = {
  register: () => import('@/app/api/v1/auth/register/route'),
  login: () => import('@/app/api/v1/auth/login/route'),
  logout: () => import('@/app/api/v1/auth/logout/route'),
  forgot: () => import('@/app/api/v1/auth/password/forgot/route'),
  reset: () => import('@/app/api/v1/auth/password/reset/route'),
} as const;

function post(body: string | undefined, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/auth/x', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers },
  });
}

describe('routes /api/v1/auth/*', () => {
  it('exposent chacune une fonction POST', async () => {
    for (const load of Object.values(ROUTES)) expect(typeof (await load()).POST).toBe('function');
  });

  for (const name of ['register', 'login', 'forgot', 'reset'] as const) {
    it(`${name} : un corps vide {} donne 400 VALIDATION_ERROR au format unique`, async () => {
      const { POST } = await ROUTES[name]();
      const res = await POST(post('{}'));
      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toEqual(expect.any(String));
      expect(error.request_id).toMatch(/^req_/);
      expect(Object.keys(error.details.fields).length).toBeGreaterThan(0);
    });

    it(`${name} : un JSON cassé donne 400 VALIDATION_ERROR (pas 500)`, async () => {
      const { POST } = await ROUTES[name]();
      const res = await POST(post('{pas du json'));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });
  }

  it('register : signale les champs fautifs et ne renvoie pas le mot de passe saisi', async () => {
    const { POST } = await ROUTES.register();
    const body = JSON.stringify({
      email: 'pas-un-email',
      password: 'Cf9!vQ2#zLm7-rTa84',
      phone: '+237600000001',
      country: 'FR',
      display_currency: 'XAF',
      language: 'fr',
      turnstile_token: 't',
    });
    const res = await POST(post(body));
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(Object.keys(JSON.parse(text).error.details.fields).sort()).toEqual(['country', 'email']);
    expect(text).not.toContain('Cf9!vQ2#zLm7-rTa84');
  });

  it('login : message en anglais avec NEXT_LOCALE=en', async () => {
    const { POST } = await ROUTES.login();
    const fr = (await (await POST(post('{}'))).json()).error.message;
    const en = (await (await POST(post('{}', { cookie: 'NEXT_LOCALE=en' }))).json()).error.message;
    expect(en).not.toBe(fr);
  });

  it("refuse une requête venant d'une autre origine (CSRF, API_SPEC §2)", async () => {
    const { POST } = await ROUTES.login();
    const res = await POST(
      post(JSON.stringify({ identifier: 'a@b.co', password: 'x', turnstile_token: 't' }), {
        origin: 'https://evil.example',
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });
});
