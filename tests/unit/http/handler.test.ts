import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));
const { notifyOwner } = vi.hoisted(() => ({
  notifyOwner: vi.fn<(event: string, data: unknown) => Promise<void>>(async () => {}),
}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner }));

import { handler } from '@/server/http/handler';
import { apiError } from '@/server/http/api-error';

function req(init: { headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest('http://localhost/api/v1/test', {
    method: 'POST',
    headers: init.headers,
    body: init.body,
  });
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  notifyOwner.mockClear();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('handler', () => {
  it('renvoie le JSON retourné avec le statut 200', async () => {
    const res = await handler(async () => ({ user: { id: 'u1' } }))(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'u1' } });
  });
  it('laisse passer une Response telle quelle (ex. 201, 204)', async () => {
    const res = await handler(async () => new Response(null, { status: 204 }))(req());
    expect(res.status).toBe(204);
  });
  it("transforme une ApiError en format unique d'API_SPEC §3", async () => {
    const res = await handler(async () =>
      apiError('PHONE_TAKEN', { fields: { phone: 'PHONE_TAKEN' } }),
    )(req());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('PHONE_TAKEN');
    expect(body.error.message).toEqual(expect.any(String));
    expect(body.error.details).toEqual({ fields: { phone: 'PHONE_TAKEN' } });
    expect(body.error.request_id).toMatch(/^req_[0-9a-f]{6,}$/);
    expect(res.headers.get('x-request-id')).toBe(body.error.request_id);
  });
  it('donne un request_id différent à chaque appel', async () => {
    const h = handler(async () => apiError('NOT_FOUND'));
    const a = (await (await h(req())).json()).error.request_id;
    const b = (await (await h(req())).json()).error.request_id;
    expect(a).not.toBe(b);
  });
  it('répond en français par défaut, en anglais avec NEXT_LOCALE=en ou Accept-Language: en', async () => {
    const h = handler(async () => apiError('INVALID_CREDENTIALS'));
    const msg = async (headers?: Record<string, string>) =>
      (await (await h(req({ headers }))).json()).error.message as string;
    const fr = await msg();
    const viaCookie = await msg({ cookie: 'NEXT_LOCALE=en' });
    expect(viaCookie).not.toBe(fr);
    expect(await msg({ 'accept-language': 'en-GB,en;q=0.8' })).toBe(viaCookie);
    expect(await msg({ 'accept-language': 'es' })).toBe(fr);
  });
  it('transmet requestId et locale au corps de la route', async () => {
    let seen: { requestId?: string; locale?: string } = {};
    await handler(async (...args) => {
      seen = args[1];
      return {};
    })(req({ headers: { cookie: 'NEXT_LOCALE=en' } }));
    expect(seen.requestId).toMatch(/^req_/);
    expect(seen.locale).toBe('en');
  });
  it('transforme une ZodError en VALIDATION_ERROR 400 avec details.fields', async () => {
    const res = await handler(async () =>
      z.object({ email: z.string().email() }).parse({ email: 'x' }),
    )(req());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(body.error.details.fields)).toContain('email');
  });
  it("ajoute l'en-tête Retry-After pour AUTH_LOCKED", async () => {
    const res = await handler(async () => apiError('AUTH_LOCKED', { retry_after_seconds: 900 }))(
      req(),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('900');
  });
  it('erreur inconnue : 500 INTERNAL_ERROR sans fuite + alerte propriétaire', async () => {
    const res = await handler(async () => {
      throw new Error('SELECT * FROM secret_table password=hunter2');
    })(req());
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).error.code).toBe('INTERNAL_ERROR');
    expect(text).not.toMatch(/SELECT|hunter2|secret_table|stack/i);
    expect(notifyOwner).toHaveBeenCalledWith('internal_error', expect.anything());
  });
  it('ne journalise jamais le mot de passe, le jeton ni les en-têtes Authorization/cookie', async () => {
    const body = JSON.stringify({
      identifier: 'a@b.co',
      password: 'Sup3r-Secret-pw',
      turnstile_token: 'tok-ABC',
    });
    await handler(async (r) => {
      await r.json();
      throw new Error('boom');
    })(
      req({
        body,
        headers: { authorization: 'Bearer jeton-secret-xyz', cookie: 'sb-access=cookie-secret' },
      }),
    );
    const logged = JSON.stringify(errorSpy.mock.calls) + JSON.stringify(notifyOwner.mock.calls);
    for (const secret of ['Sup3r-Secret-pw', 'tok-ABC', 'jeton-secret-xyz', 'cookie-secret'])
      expect(logged).not.toContain(secret);
  });
});
