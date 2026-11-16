import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendReq, type ErrorBody } from '../helpers/client-area-db';
import { load } from '../helpers/admin-db';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}));
const svc = vi.hoisted(() => ({ adminLogin: vi.fn() }));
vi.mock('@/server/admin/login', () => svc);

/*
 * Route POST /api/v1/admin/login (src/app/api/v1/admin/login/route.ts) : enveloppe HTTP de adminLogin.
 * Corps : { identifier, password, turnstile_token, admin_path }. Même origine obligatoire, corps validé (Zod),
 * l'adresse IP et `admin_path` sont transmises au service ; les erreurs du service sortent au format API_SPEC §3.
 */
type Handler = (req: Request) => Promise<Response>;
const post = async (body: unknown, headers: Record<string, string> = {}) =>
  (await load<{ POST: Handler }>('@/app/api/v1/admin/login/route')).POST(
    sendReq('POST', '/api/v1/admin/login', body, { 'x-forwarded-for': '203.0.113.9', ...headers }),
  );
const valid = {
  identifier: 'proprietaire@lyonpanel.test',
  password: 'Un-bon-mot-de-passe-42',
  turnstile_token: 'tok',
  admin_path: 'k7q2-test-path-9f3a',
};

beforeEach(() => {
  svc.adminLogin.mockReset().mockResolvedValue({ user: { id: 'admin-1' } });
});

describe('POST /api/v1/admin/login', () => {
  it('corps valide : 200, le service reçoit l’adresse secrète et l’adresse IP', async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(svc.adminLogin).toHaveBeenCalledTimes(1);
    expect(svc.adminLogin.mock.calls[0]?.[0]).toMatchObject({
      identifier: valid.identifier,
      admin_path: valid.admin_path,
      turnstile_token: 'tok',
      ip: '203.0.113.9',
    });
  });

  it('404 du service (mauvaise adresse secrète) : 404 NOT_FOUND au format commun', async () => {
    const { apiError } = await import('@/server/http/api-error');
    svc.adminLogin.mockImplementation(async () => apiError('NOT_FOUND'));
    const res = await post({ ...valid, admin_path: 'mauvaise-adresse' });
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorBody).error.code).toBe('NOT_FOUND');
  });

  it('INVALID_CREDENTIALS du service : 401 avec le message neutre', async () => {
    const { apiError } = await import('@/server/http/api-error');
    svc.adminLogin.mockImplementation(async () => apiError('INVALID_CREDENTIALS'));
    const res = await post(valid);
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');
  });

  it.each([
    ['sans mot de passe', { ...valid, password: undefined }],
    ['sans jeton Turnstile', { ...valid, turnstile_token: undefined }],
    ['sans identifiant', { ...valid, identifier: undefined }],
    ['mot de passe de 129 caractères', { ...valid, password: 'a'.repeat(129) }],
    ['adresse secrète non texte', { ...valid, admin_path: 42 }],
  ])('%s : 400 VALIDATION_ERROR, service jamais appelé', async (_n, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(svc.adminLogin).not.toHaveBeenCalled();
  });

  it('autre origine : refusé, service jamais appelé', async () => {
    const res = await post(valid, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(svc.adminLogin).not.toHaveBeenCalled();
  });

  it('la route n’expose que POST', async () => {
    const m = await load<Record<string, unknown>>('@/app/api/v1/admin/login/route');
    expect(m.POST).toBeTypeOf('function');
    expect(m.GET).toBeUndefined();
  });
});
