import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProviderFixture } from '../../helpers/provider-fixture';

vi.mock('server-only', () => ({}));

import { createProviderClient } from '@/server/providers/provider-client';

// Module attendu : src/server/providers/provider-client.ts
//   createProviderClient({ apiUrl, apiKey, fetch?, timeoutMs? }): ProviderApi
//   - POST vers apiUrl, champ `key` dans le corps (jamais dans l'adresse), `action` = services | balance | add | status
//   - délai par défaut 10 000 ms (signal d'annulation passé à fetch)
//   - toute erreur -> ApiError (code PROVIDER_ERROR ou PROVIDER_TIMEOUT), sans clé ni message brut
//   - add() : JAMAIS de nouvel essai automatique
// Aucun appel réseau réel : fetch est toujours simulé.

const KEY = 'SECRETKEY-abc123-do-not-leak';
const URL_ = 'https://provider.example.invalid/api/v2';

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sentBody(f: FetchMock, call = 0): Record<string, string> {
  const init = f.mock.calls[call]?.[1];
  const raw = init?.body;
  if (raw instanceof URLSearchParams) return Object.fromEntries(raw);
  const text = String(raw);
  try {
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

function client(f: FetchMock, extra: { timeoutMs?: number } = {}) {
  return createProviderClient({
    apiUrl: URL_,
    apiKey: KEY,
    fetch: f as unknown as typeof fetch,
    ...extra,
  });
}

const spies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
  }
});
afterEach(() => {
  spies.length = 0;
  vi.restoreAllMocks();
});

function allLogged(): string {
  return spies.map((s) => JSON.stringify(s.mock.calls)).join('\n');
}

describe('client fournisseur : requêtes', () => {
  it('services() envoie un POST avec le champ key et action=services', async () => {
    const f = vi.fn<typeof fetch>(async () => json(loadProviderFixture()));
    await client(f).services();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe(URL_);
    expect(init?.method).toBe('POST');
    expect(sentBody(f)).toMatchObject({ key: KEY, action: 'services' });
  });

  it('ne met jamais la clé dans l adresse', async () => {
    const f = vi.fn<typeof fetch>(async () => json(loadProviderFixture()));
    await client(f).services();
    expect(String(f.mock.calls[0]![0])).not.toContain(KEY);
  });

  it('passe un signal d annulation à fetch (délai de 10 s par défaut)', async () => {
    const f = vi.fn<typeof fetch>(async () => json(loadProviderFixture()));
    await client(f).services();
    const signal = f.mock.calls[0]![1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it('services() renvoie la liste validée', async () => {
    const f = vi.fn<typeof fetch>(async () => json(loadProviderFixture()));
    const list = await client(f).services();
    expect(list).toHaveLength(loadProviderFixture().length);
    expect(list[0]).toHaveProperty('service');
  });

  it('balance() lit le solde en dollars', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ balance: '123.4567', currency: 'USD' }));
    const b = await client(f).balance();
    expect(sentBody(f)).toMatchObject({ key: KEY, action: 'balance' });
    expect(b).toEqual({ balance: 123.4567, currency: 'USD' });
  });

  it('balance() refuse une autre devise que USD', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ balance: '10', currency: 'EUR' }));
    await expect(client(f).balance()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('add() envoie service, link, quantity et renvoie le numéro de commande', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ order: 23501 }));
    const res = await client(f).add({ service: 31579, link: 'https://t.me/abc', quantity: 100 });
    expect(sentBody(f)).toMatchObject({
      key: KEY,
      action: 'add',
      service: '31579',
      link: 'https://t.me/abc',
      quantity: '100',
    });
    expect(res).toEqual({ order: 23501 });
  });

  it('add() envoie les commentaires une ligne par commentaire', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ order: 1 }));
    await client(f).add({
      service: 15226,
      link: 'https://y.be/x',
      quantity: 2,
      comments: ['super', 'bravo'],
    });
    expect(sentBody(f).comments).toBe('super\nbravo');
  });

  it('status() demande les commandes séparées par des virgules et indexe la réponse par numéro', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      json({
        '1': {
          charge: '0.27',
          start_count: '3572',
          status: 'Partial',
          remains: '157',
          currency: 'USD',
        },
        '2': {
          charge: '1.00',
          start_count: '0',
          status: 'Completed',
          remains: '0',
          currency: 'USD',
        },
      }),
    );
    const res = await client(f).status([1, 2]);
    expect(sentBody(f)).toMatchObject({ key: KEY, action: 'status', orders: '1,2' });
    expect(res[1]?.status).toBe('Partial');
    expect(res[2]?.status).toBe('Completed');
  });
});

describe('client fournisseur : erreurs typées', () => {
  it('une réponse invalide (Zod) est refusée avec PROVIDER_ERROR', async () => {
    const bad = [{ service: 1, name: 'x' }]; // pas de coût, pas de bornes
    const f = vi.fn<typeof fetch>(async () => json(bad));
    await expect(client(f).services()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('une erreur HTTP 500 donne PROVIDER_ERROR', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ error: 'boom' }, 500));
    await expect(client(f).services()).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      status: 502,
    });
  });

  it('un corps qui n est pas du JSON donne PROVIDER_ERROR', async () => {
    const f = vi.fn<typeof fetch>(
      async () => new Response('<html>Bad gateway</html>', { status: 200 }),
    );
    await expect(client(f).services()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('une réponse {"error": "..."} en HTTP 200 donne PROVIDER_ERROR', async () => {
    const f = vi.fn<typeof fetch>(async () => json({ error: 'Incorrect API key' }));
    await expect(client(f).balance()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('une panne réseau donne PROVIDER_ERROR', async () => {
    const f = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(client(f).services()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('un délai dépassé donne PROVIDER_TIMEOUT (504)', async () => {
    const f = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    await expect(client(f, { timeoutMs: 30 }).services()).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
      status: 504,
    });
  });

  it('une exception TimeoutError de fetch donne PROVIDER_TIMEOUT', async () => {
    const f = vi.fn<typeof fetch>(async () => {
      throw new DOMException('The operation timed out', 'TimeoutError');
    });
    await expect(client(f).services()).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
  });
});

describe('client fournisseur : add() n est JAMAIS relancé automatiquement', () => {
  it.each([
    ['panne réseau', () => Promise.reject(new TypeError('fetch failed'))],
    ['erreur HTTP 500', () => Promise.resolve(json({ error: 'x' }, 500))],
    ['erreur HTTP 429', () => Promise.resolve(json({ error: 'slow down' }, 429))],
    ['délai dépassé', () => Promise.reject(new DOMException('timeout', 'TimeoutError'))],
    ['réponse invalide', () => Promise.resolve(json({ nope: true }))],
  ])('%s : un seul appel à fetch', async (_label, impl) => {
    const f = vi.fn<typeof fetch>(impl);
    await expect(
      client(f).add({ service: 1, link: 'https://x.test', quantity: 10 }),
    ).rejects.toBeDefined();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('un délai dépassé sur add() donne PROVIDER_TIMEOUT sans second appel', async () => {
    const f = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    await expect(
      client(f, { timeoutMs: 30 }).add({ service: 1, link: 'https://x.test', quantity: 10 }),
    ).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('client fournisseur : la clé ne fuit jamais', () => {
  const failures: [string, () => Promise<Response>][] = [
    ['HTTP 500 qui répète la clé', () => Promise.resolve(json({ error: `bad key ${KEY}` }, 500))],
    [
      'HTTP 200 avec erreur qui répète la clé',
      () => Promise.resolve(json({ error: `bad key ${KEY}` })),
    ],
    [
      'texte brut qui répète la clé',
      () => Promise.resolve(new Response(`oops ${KEY}`, { status: 502 })),
    ],
    [
      'panne réseau qui répète la clé',
      () => Promise.reject(new TypeError(`failed ${URL_}?key=${KEY}`)),
    ],
  ];

  it.each(failures)(
    '%s : ni le message, ni les détails, ni les journaux ne contiennent la clé',
    async (_l, impl) => {
      const f = vi.fn<typeof fetch>(impl);
      const err = await client(f)
        .services()
        .then(
          () => null,
          (e: unknown) => e as Error & { details?: unknown },
        );
      expect(err).not.toBeNull();
      const dump = JSON.stringify({
        m: err?.message,
        s: err?.stack,
        d: err?.details,
        all: String(err),
      });
      expect(dump).not.toContain(KEY);
      expect(allLogged()).not.toContain(KEY);
    },
  );

  it('ne renvoie jamais le message brut du fournisseur', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      json({ error: 'Incorrect API key, contact Peakerr support' }),
    );
    const err = (await client(f)
      .balance()
      .catch((e: unknown) => e)) as Error;
    expect(
      `${err.message} ${JSON.stringify((err as { details?: unknown }).details ?? {})}`,
    ).not.toMatch(/peakerr|incorrect api key/i);
  });

  it('une réussite ne journalise pas la clé non plus', async () => {
    const f = vi.fn<typeof fetch>(async () => json(loadProviderFixture()));
    await client(f).services();
    expect(allLogged()).not.toContain(KEY);
  });
});
