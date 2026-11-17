import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, auditRows, callRoute, failAuditFor, makeService } from '../helpers/admin-phase12';
import { getReq, type ErrorBody } from '../helpers/client-area-db';
import { setSetting } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

import { GET as publicCatalog } from '@/app/api/v1/services/route';

/*
 * Services côté admin (phase 12, décision 3). Colonnes : `multiplier` (surcharge du multiplicateur, c'est la « marge » du service),
 * `name_fr`, `name_en` (NOUVELLE colonne à prévoir par lp-db), `active`, `sort_order`.
 * Prix client = computePricePer1000Xaf(cost_usd_1000, usd_xaf_rate, multiplier), calculé côté serveur, jamais lu dans la requête.
 *   PATCH /admin/services/{id} : un changement de `multiplier` exige `confirm: true` (sinon 400) ;
 *   POST  /admin/services/{id}/preview { multiplier } -> { old_price_xaf_1000, new_price_xaf_1000 } sans rien écrire ;
 *   une seule ressource par requête : aucune route ni corps « en masse ».
 * Audit : action `update_service`, target_id = id du service, details { changes: { champ: { old, new } } }.
 */
const db = adminClient();
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const created: number[] = [];
const code = async (r: Response) => ((await r.json()) as ErrorBody).error.code;

async function service(over: Record<string, unknown> = {}) {
  const s = await makeService({
    cost_usd_1000: 1.5,
    multiplier: 3,
    price_xaf_1000: 2700,
    name_fr: `Abonnés LP12 ${randomUUID().slice(0, 8)}`,
    ...over,
  });
  created.push(s.id);
  return s;
}
const patch = (id: number, body: unknown) =>
  callRoute(ROUTES.service, 'PATCH', `/api/v1/admin/services/${id}`, { body, id: String(id) });
const preview = (id: number, body: unknown) =>
  callRoute(ROUTES.preview, 'POST', `/api/v1/admin/services/${id}/preview`, {
    body,
    id: String(id),
  });
const row = async (id: number) =>
  (await db.from('services').select('*').eq('id', id).single()).data as Record<string, unknown>;

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await setSetting('usd_xaf_rate', 600);
  await admin.release();
});
beforeEach(async () => {
  await setSetting('usd_xaf_rate', 600);
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  // Les services de test restent (commandes liées possibles) mais sortent du catalogue.
  if (created.length) await db.from('services').update({ active: false }).in('id', created);
  created.length = 0;
});

describe('GET /admin/services', () => {
  it('donne le catalogue complet avec coût, multiplicateur et nom fournisseur (admin seulement)', async () => {
    const s = await service();
    const res = await callRoute(
      ROUTES.services,
      'GET',
      '/api/v1/admin/services?platform=tiktok&active=true',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    const item = body.items.find((i) => i.id === s.id);
    expect(item).toMatchObject({
      provider_name: 'PROVIDER test service',
      multiplier: 3,
      price_xaf_1000: 2700,
    });
    expect(Number(item!.cost_usd_1000)).toBe(1.5);
  });

  it('le filtre active=false ne renvoie que des services masqués', async () => {
    await service({ active: false });
    const res = await callRoute(ROUTES.services, 'GET', '/api/v1/admin/services?active=false');
    const body = (await res.json()) as { items: { active: boolean }[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => i.active === false)).toBe(true);
  });

  it('aucune route en masse : le module n’expose que GET', async () => {
    const mod = (await import(/* @vite-ignore */ ROUTES.services)) as Record<string, unknown>;
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(mod[m], m).toBeUndefined();
  });
});

describe('PATCH /admin/services/{id} : activer, nom, ordre', () => {
  it('masquer un service le retire du catalogue public, le réactiver le remet', async () => {
    const s = await service();
    expect((await patch(s.id, { active: false })).status).toBe(200);
    expect(await publicCatalog(getReq('/api/v1/services')).then((r) => r.text())).not.toContain(
      String(s.name_fr),
    );
    expect((await patch(s.id, { active: true })).status).toBe(200);
    expect(await publicCatalog(getReq('/api/v1/services')).then((r) => r.text())).toContain(
      String(s.name_fr),
    );
  });

  it('change le nom FR, le nom EN et l’ordre d’affichage, avec ancienne et nouvelle valeur dans le journal', async () => {
    const s = await service();
    const res = await patch(s.id, {
      name_fr: 'Nouveau nom FR',
      name_en: 'New EN name',
      sort_order: 7,
    });
    expect(res.status).toBe(200);
    expect(await row(s.id)).toMatchObject({
      name_fr: 'Nouveau nom FR',
      name_en: 'New EN name',
      sort_order: 7,
    });
    const rows = await auditRows('update_service', String(s.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_id).toBe(admin.id);
    expect(rows[0]!.details).toMatchObject({
      changes: { name_fr: { old: s.name_fr, new: 'Nouveau nom FR' }, sort_order: { new: 7 } },
    });
  });

  it('refuse un prix, un coût ou le nom du fournisseur dans le corps : 400, rien ne change', async () => {
    const s = await service();
    for (const body of [{ price_xaf_1000: 1 }, { cost_usd_1000: 0.01 }, { provider_name: 'x' }]) {
      expect((await patch(s.id, body)).status).toBe(400);
    }
    expect(await row(s.id)).toMatchObject({
      price_xaf_1000: 2700,
      provider_name: 'PROVIDER test service',
    });
  });

  it('refuse un changement en masse (liste d’identifiants dans le corps)', async () => {
    const s = await service();
    expect((await patch(s.id, { ids: [s.id], active: false })).status).toBe(400);
    expect((await row(s.id)).active).toBe(true);
  });

  it('service inconnu : 404', async () => {
    expect((await patch(8_999_999_999 % 2_000_000_000, { active: false })).status).toBe(404);
  });

  it('atomique : si la trace échoue, le service reste inchangé', async () => {
    const s = await service();
    const restore = failAuditFor(['update_service']);
    try {
      expect((await patch(s.id, { active: false })).status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    expect((await row(s.id)).active).toBe(true);
  });
});

describe('marge d’un service : aperçu, confirmation, recalcul serveur', () => {
  it('aperçu : 1 000 abonnés passent de 2 700 à 3 150 XAF, sans rien écrire', async () => {
    const s = await service();
    const res = await preview(s.id, { multiplier: 3.5 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ old_price_xaf_1000: 2700, new_price_xaf_1000: 3150 });
    expect((await row(s.id)).multiplier).toBe(3);
    expect(await auditRows('update_service', String(s.id))).toHaveLength(0);
  });

  it('changer la marge sans confirmation : 400, prix inchangé', async () => {
    const s = await service();
    const res = await patch(s.id, { multiplier: 3.5 });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
    expect(await row(s.id)).toMatchObject({ multiplier: 3, price_xaf_1000: 2700 });
  });

  it('avec confirmation : le prix est recalculé côté serveur (3 150) et tracé avec ancien et nouveau prix', async () => {
    const s = await service();
    const res = await patch(s.id, { multiplier: 3.5, confirm: true });
    expect(res.status).toBe(200);
    expect(await row(s.id)).toMatchObject({ multiplier: 3.5, price_xaf_1000: 3150 });
    const [log] = await auditRows('update_service', String(s.id));
    expect(log!.details).toMatchObject({
      changes: { multiplier: { old: 3, new: 3.5 }, price_xaf_1000: { old: 2700, new: 3150 } },
    });
  });

  it('un confirm: true sans changement de marge ne change aucun prix', async () => {
    const s = await service();
    await patch(s.id, { name_fr: 'Autre nom', confirm: true });
    expect((await row(s.id)).price_xaf_1000).toBe(2700);
  });

  it.each([0, -2, 51, 'abc'])('multiplicateur %j refusé (aperçu et enregistrement)', async (m) => {
    const s = await service();
    expect((await preview(s.id, { multiplier: m })).status).toBe(400);
    expect((await patch(s.id, { multiplier: m, confirm: true })).status).toBe(400);
    expect((await row(s.id)).price_xaf_1000).toBe(2700);
  });
});

describe('coût et nom du fournisseur : jamais côté client', () => {
  it('le catalogue public ne contient ni coût, ni multiplicateur, ni nom du fournisseur', async () => {
    const s = await service();
    await patch(s.id, { multiplier: 4, confirm: true });
    const text = await publicCatalog(getReq('/api/v1/services')).then((r) => r.text());
    expect(text).toContain(String(s.name_fr));
    for (const secret of [
      'cost_usd',
      'provider_name',
      'PROVIDER test service',
      'multiplier',
      'margin',
    ]) {
      expect(text, secret).not.toContain(secret);
    }
  });
});
