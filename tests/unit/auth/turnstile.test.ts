import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requireTurnstile, verifyTurnstile } from '@/server/auth/turnstile';

// Clé secrète de test publiée par Cloudflare (toujours « réussi »).
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', TEST_SECRET);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const reply = (body: unknown, ok = true) =>
  fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });

describe('verifyTurnstile', () => {
  it("interroge siteverify de Cloudflare avec la clé secrète, le jeton et l'IP", async () => {
    reply({ success: true });
    await verifyTurnstile('jeton-123', '203.0.113.7');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.method).toBe('POST');
    const sent = String(init.body);
    expect(sent).toContain(TEST_SECRET);
    expect(sent).toContain('jeton-123');
    expect(sent).toContain('203.0.113.7');
  });
  it('renvoie true quand Cloudflare répond success: true', async () => {
    reply({ success: true });
    expect(await verifyTurnstile('t', '1.1.1.1')).toBe(true);
  });
  it('renvoie false quand Cloudflare répond success: false', async () => {
    reply({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await verifyTurnstile('t', '1.1.1.1')).toBe(false);
  });
  it('renvoie false si Cloudflare est injoignable ou répond une erreur (on refuse par prudence)', async () => {
    fetchMock.mockRejectedValue(new Error('réseau coupé'));
    expect(await verifyTurnstile('t', '1.1.1.1')).toBe(false);
    reply({}, false);
    expect(await verifyTurnstile('t', '1.1.1.1')).toBe(false);
  });
  it('renvoie false sans appeler Cloudflare quand le jeton est vide', async () => {
    expect(await verifyTurnstile('', '1.1.1.1')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('renvoie false quand la clé secrète est absente', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    reply({ success: true });
    expect(await verifyTurnstile('t', '1.1.1.1')).toBe(false);
  });
});

describe('requireTurnstile', () => {
  it('ne fait rien si le jeton est valide', async () => {
    reply({ success: true });
    await expect(requireTurnstile('t', '1.1.1.1')).resolves.toBeUndefined();
  });
  it('lève TURNSTILE_FAILED (400) sans révéler la clé secrète', async () => {
    reply({ success: false });
    const err = await requireTurnstile('t', '1.1.1.1').catch((e) => e);
    expect(err).toMatchObject({ code: 'TURNSTILE_FAILED', status: 400 });
    expect(JSON.stringify(err)).not.toContain(TEST_SECRET);
    expect(String(err.message)).not.toContain(TEST_SECRET);
  });
});
