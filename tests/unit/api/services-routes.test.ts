import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

// Couche de lecture du catalogue public, simulée (la vraie lit la vue services_public).
const { rows, rate, failure } = vi.hoisted(() => ({
  rows: { current: [] as Record<string, unknown>[] },
  rate: { current: 600 },
  failure: { current: null as Error | null },
}));
vi.mock('@/server/catalog/public-catalog', () => ({
  listPublicServices: vi.fn(async () => {
    if (failure.current) throw failure.current;
    return rows.current;
  }),
  getPublicService: vi.fn(async (id: number) => {
    if (failure.current) throw failure.current;
    return rows.current.find((r) => r.id === id) ?? null;
  }),
  getUsdXafRate: vi.fn(async () => rate.current),
}));

import { GET as listServices } from '@/app/api/v1/services/route';
import { GET as getService } from '@/app/api/v1/services/[id]/route';

// Routes attendues (adresses de l'API existante, préfixe /api/v1, voir API_SPEC §6.4) :
//   GET /api/v1/services?currency=XAF|XOF|USD&locale=fr|en
//        -> { currency, locale, networks: [{ network, label, types: [{ type, label, services: [PublicService] }] }] }
//   GET /api/v1/services/{id}[?currency=&locale=] -> PublicService, ou 404 NOT_FOUND (format unique §3)
// PublicService = { id, name, network, type, priceXaf1000, minQty, maxQty, minOrderXaf,
//                   refill, cancel, dripfeed, displayPrice1000, displayMinOrder }
// Module de données attendu : src/server/catalog/public-catalog.ts
//   listPublicServices(), getPublicService(id), getUsdXafRate()  (lignes de la vue services_public)

const PUBLIC_KEYS = [
  'cancel',
  'displayMinOrder',
  'displayPrice1000',
  'dripfeed',
  'id',
  'maxQty',
  'minOrderXaf',
  'minQty',
  'name',
  'network',
  'priceXaf1000',
  'refill',
  'type',
];

function row(over: Record<string, unknown> = {}) {
  return {
    id: 100,
    platform: 'tiktok',
    category: 'followers',
    name_fr: 'Abonnés TikTok #100',
    price_xaf_1000: 1800,
    min_qty: 10,
    max_qty: 100000,
    refill: true,
    cancel: false,
    dripfeed: false,
    sort_order: 0,
    ...over,
  };
}

// Colonnes cachées qui ne doivent JAMAIS ressortir, même si la couche de données les laissait passer.
const LEAKY = {
  provider_name: 'Instagram - Likes | Real | MQ 50K [PEAKERR EXCLUSIVE]',
  provider_type: 'Default',
  cost_usd_1000: 0.756,
  multiplier: 4,
  margin_pct: 60,
};

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

async function list(query = '', headers: Record<string, string> = {}) {
  const res = await listServices(req(`/api/v1/services${query}`, headers));
  return { res, body: await res.json() };
}

async function one(id: string, query = '', headers: Record<string, string> = {}) {
  const res = await getService(req(`/api/v1/services/${id}${query}`, headers), {
    params: Promise.resolve({ id }),
  });
  return { res, body: await res.json() };
}

beforeEach(() => {
  rows.current = [
    row({ id: 100 }),
    row({ id: 101, name_fr: 'Abonnés TikTok #101', price_xaf_1000: 1370, min_qty: 100 }),
    row({
      id: 102,
      category: 'likes',
      name_fr: 'Likes TikTok #102',
      price_xaf_1000: 1365,
      min_qty: 10,
    }),
    row({
      id: 200,
      platform: 'instagram',
      category: 'views',
      name_fr: 'Vues Instagram #200',
      price_xaf_1000: 5,
    }),
  ];
  rate.current = 600;
  failure.current = null;
});

describe('GET /api/v1/services', () => {
  it('répond 200 avec la liste groupée réseau -> type -> services', async () => {
    const { res, body } = await list();
    expect(res.status).toBe(200);
    expect(body.currency).toBe('XAF');
    expect(body.networks.map((n: { network: string }) => n.network).sort()).toEqual([
      'instagram',
      'tiktok',
    ]);
    const tiktok = body.networks.find((n: { network: string }) => n.network === 'tiktok');
    expect(tiktok.types.map((t: { type: string }) => t.type).sort()).toEqual([
      'followers',
      'likes',
    ]);
    const followers = tiktok.types.find((t: { type: string }) => t.type === 'followers');
    expect(followers.services.map((s: { id: number }) => s.id).sort()).toEqual([100, 101]);
  });

  it('donne un libellé à chaque réseau et à chaque type, dans la langue demandée', async () => {
    const fr = (await list('?locale=fr')).body;
    const en = (await list('?locale=en')).body;
    const frTikTok = fr.networks.find((n: { network: string }) => n.network === 'tiktok');
    const enTikTok = en.networks.find((n: { network: string }) => n.network === 'tiktok');
    expect(frTikTok.label).toBe('TikTok');
    expect(frTikTok.types.find((t: { type: string }) => t.type === 'followers').label).toBe(
      'Abonnés',
    );
    expect(enTikTok.types.find((t: { type: string }) => t.type === 'followers').label).toBe(
      'Followers',
    );
    expect(fr.locale).toBe('fr');
    expect(en.locale).toBe('en');
  });

  it('ne renvoie que les champs publics, rien d autre', async () => {
    const { body } = await list();
    const service = body.networks[0].types[0].services[0];
    expect(Object.keys(service).sort()).toEqual(PUBLIC_KEYS);
  });

  it('renvoie les prix en XAF entiers et le prix de la commande minimum', async () => {
    const { body } = await list();
    const all = body.networks.flatMap((n: { types: { services: Record<string, number>[] }[] }) =>
      n.types.flatMap((t) => t.services),
    );
    const byId = new Map(all.map((s: Record<string, number>) => [s.id, s]));
    expect(byId.get(102)).toMatchObject({ priceXaf1000: 1365, minQty: 10, minOrderXaf: 15 });
    expect(byId.get(100)).toMatchObject({ priceXaf1000: 1800, minOrderXaf: 20 }); // 18 -> 20
    expect(byId.get(200)).toMatchObject({ priceXaf1000: 5, minOrderXaf: 5 });
    for (const s of all) {
      expect(Number.isInteger(s.priceXaf1000)).toBe(true);
      expect(Number.isInteger(s.minOrderXaf)).toBe(true);
      expect(s.minOrderXaf % 5).toBe(0);
    }
  });

  it('reconstruit le nom dans la langue demandée, avec le numéro', async () => {
    const fr = (await list('?locale=fr')).body.networks[0].types[0].services[0].name;
    const en = (await list('?locale=en')).body.networks[0].types[0].services[0].name;
    expect(fr).not.toBe(en);
    expect(fr).toContain('#');
    expect(en).toContain('#');
  });

  it('XOF a la même valeur que XAF (parité)', async () => {
    const xaf = (await list('?currency=XAF')).body;
    const xof = (await list('?currency=XOF')).body;
    expect(xof.currency).toBe('XOF');
    const a = xaf.networks[0].types[0].services[0];
    const b = xof.networks[0].types[0].services[0];
    expect(b.displayPrice1000).toBe(a.displayPrice1000);
    expect(b.displayPrice1000).toBe(b.priceXaf1000);
    expect(b.displayMinOrder).toBe(b.minOrderXaf);
  });

  it('USD = XAF / taux, arrondi à 2 décimales (affichage seulement)', async () => {
    const { body } = await list('?currency=USD');
    const all = body.networks.flatMap((n: { types: { services: Record<string, number>[] }[] }) =>
      n.types.flatMap((t) => t.services),
    );
    const byId = new Map(all.map((s: Record<string, number>) => [s.id, s]));
    expect(body.currency).toBe('USD');
    expect(byId.get(100)).toMatchObject({
      priceXaf1000: 1800,
      displayPrice1000: 3,
      displayMinOrder: 0.03,
    });
    expect(byId.get(101)).toMatchObject({ priceXaf1000: 1370, displayPrice1000: 2.28 });
  });

  it('le taux vient du réglage, pas du code', async () => {
    rate.current = 550;
    const { body } = await list('?currency=USD');
    const s = body.networks
      .flatMap((n: { types: { services: Record<string, number>[] }[] }) =>
        n.types.flatMap((t) => t.services),
      )
      .find((x: Record<string, number>) => x.id === 100);
    expect(s.displayPrice1000).toBe(3.27); // 1800 / 550
    expect(s.priceXaf1000).toBe(1800); // le prix réel ne bouge pas
  });

  it('refuse une devise inconnue avec VALIDATION_ERROR au format unique', async () => {
    const { res, body } = await list('?currency=EUR');
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.request_id).toMatch(/^req_/);
    expect(Object.keys(body.error.details.fields)).toContain('currency');
  });

  it('refuse une langue inconnue avec VALIDATION_ERROR', async () => {
    const { res, body } = await list('?locale=de');
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('renvoie une liste vide quand le catalogue est vide', async () => {
    rows.current = [];
    const { res, body } = await list();
    expect(res.status).toBe(200);
    expect(body.networks).toEqual([]);
  });

  it('se met en cache 5 minutes (catalogue public)', async () => {
    const { res } = await list();
    expect(res.headers.get('cache-control')).toMatch(/(s-maxage|max-age)=300/);
  });

  it('une panne de la base donne INTERNAL_ERROR au format unique, sans trace', async () => {
    failure.current = new Error('connection refused to db.internal:5432');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res, body } = await list();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('db.internal');
  });
});

describe('GET /api/v1/services : rien du fournisseur ne sort', () => {
  it('ne contient aucune clé ni texte interdit, même si la couche de données laisse passer des colonnes cachées', async () => {
    rows.current = rows.current.map((r) => ({ ...r, ...LEAKY }));
    for (const query of ['', '?currency=USD&locale=en', '?currency=XOF&locale=fr']) {
      const { body } = await list(query);
      const text = JSON.stringify(body);
      expect(text, query).not.toMatch(/peakerr/i);
      expect(text, query).not.toMatch(/provider/i);
      expect(text, query).not.toMatch(/cost/i);
      expect(text, query).not.toMatch(/multiplier|margin/i);
      for (const forbidden of [
        'costUsd1000',
        'cost',
        'multiplier',
        'margin',
        'providerName',
        'providerType',
      ]) {
        expect(text, query).not.toContain(`"${forbidden}"`);
      }
    }
  });

  it('la liste ne cite le fournisseur ni dans les noms, ni dans les libellés', async () => {
    const { body } = await list('?locale=en');
    expect(JSON.stringify(body)).not.toMatch(/peakerr|justanotherpanel|\bjap\b/i);
  });
});

describe('GET /api/v1/services/[id]', () => {
  it('renvoie le service avec exactement les champs publics', async () => {
    const { res, body } = await one('102');
    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
    expect(body).toMatchObject({
      id: 102,
      network: 'tiktok',
      type: 'likes',
      priceXaf1000: 1365,
      minQty: 10,
      maxQty: 100000,
      minOrderXaf: 15,
      refill: true,
      cancel: false,
      dripfeed: false,
    });
  });

  it('suit la devise et la langue demandées', async () => {
    const { body } = await one('100', '?currency=USD&locale=en');
    expect(body.displayPrice1000).toBe(3);
    expect(body.priceXaf1000).toBe(1800);
    expect(body.name).toContain('Followers');
  });

  it('ne laisse sortir aucune colonne cachée', async () => {
    rows.current = rows.current.map((r) => ({ ...r, ...LEAKY }));
    const { body } = await one('200');
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/peakerr|provider|cost|multiplier|margin/i);
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
  });

  it('un service inconnu donne 404 NOT_FOUND au format d erreur unique', async () => {
    const { res, body } = await one('999999');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toEqual(expect.any(String));
    expect(body.error.request_id).toMatch(/^req_/);
    expect(res.headers.get('x-request-id')).toBe(body.error.request_id);
  });

  it('traduit le message 404 selon la langue', async () => {
    const fr = (await one('999999', '', { 'accept-language': 'fr' })).body.error.message;
    const en = (await one('999999', '', { 'accept-language': 'en' })).body.error.message;
    expect(fr).not.toBe(en);
  });

  it.each(['abc', '0', '-5', '1.5', ''])(
    'un identifiant invalide (%j) donne aussi 404',
    async (id) => {
      const { res, body } = await one(id);
      expect(res.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    },
  );

  it('refuse une devise inconnue avec VALIDATION_ERROR', async () => {
    const { res, body } = await one('100', '?currency=EUR');
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
