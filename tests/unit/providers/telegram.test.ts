import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { notifyOwner } from '@/server/providers/telegram';

const TOKEN = '123456:FAKE-token-for-tests-only';
const CHAT = '-1001234567890';

let fetchSpy: ReturnType<typeof vi.fn>;
const sentText = (): string => JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)).text as string;

beforeEach(() => {
  fetchSpy = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', TOKEN);
  vi.stubEnv('TELEGRAM_CHAT_ID', CHAT);
  vi.stubEnv('PROVIDER_MODE', 'mock');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('notifyOwner', () => {
  it('préfixe le message par [TEST] hors production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    await notifyOwner('order_failed', { order_id: 'abc' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentText().startsWith('[TEST]')).toBe(true);
  });

  it('préfixe aussi quand VERCEL_ENV est absent (local)', async () => {
    vi.stubEnv('VERCEL_ENV', '');
    await notifyOwner('order_failed', { order_id: 'abc' });
    expect(sentText().startsWith('[TEST]')).toBe(true);
  });

  it('pas de préfixe [TEST] en production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    await notifyOwner('order_failed', { order_id: 'abc' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentText()).not.toContain('[TEST]');
    expect(sentText()).toContain('order_failed');
  });

  it('sans jeton ni chat_id : ne fait rien (aucun appel réseau)', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    await expect(notifyOwner('order_failed', { order_id: 'abc' })).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ne lève jamais quand le réseau échoue', async () => {
    fetchSpy.mockRejectedValue(new Error(`boom ${TOKEN}`));
    await expect(notifyOwner('order_failed', { order_id: 'abc' })).resolves.toBeUndefined();
  });

  it('ne lève jamais quand Telegram répond une erreur HTTP', async () => {
    fetchSpy.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(notifyOwner('order_failed', { order_id: 'abc' })).resolves.toBeUndefined();
  });

  it('le jeton n apparaît jamais dans le texte envoyé', async () => {
    await notifyOwner('order_failed', { order_id: 'abc' });
    expect(sentText()).not.toContain(TOKEN);
    expect(sentText()).not.toContain('FAKE-token');
  });
});
