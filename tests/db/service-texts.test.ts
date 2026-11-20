import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ensureAdmin } from '../helpers/admin-db';
import { auditRows, makeService } from '../helpers/admin-phase12';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));

import { createSupabaseCatalogStore } from '@/server/catalog/supabase-catalog-store';
import { syncServices } from '@/server/catalog/sync-services';
import { toPublicService } from '@/server/catalog/present-catalog';
import type { PublicServiceRow } from '@/server/catalog/public-catalog';

/*
 * Textes de service (décision 2026-11-17). Colonnes nullables sur `services` :
 * custom_name_fr, custom_name_en, custom_description_fr, custom_description_en (saisis par l'admin),
 * description_fr, description_en (générés à la synchro). Toutes exposées dans la vue services_public.
 * update_service(p_service, p_admin, p_changes) accepte les quatre custom_* (vide ou null = retour au texte généré).
 */
const db = adminClient();
const CUSTOM = [
  'custom_name_fr',
  'custom_name_en',
  'custom_description_fr',
  'custom_description_en',
];
const created: number[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const update = (id: number, changes: Record<string, unknown>) =>
  db.rpc('update_service', { p_service: id, p_admin: admin.id, p_changes: changes });
const pub = async (id: number) =>
  (await db.from('services_public').select('*').eq('id', id).single()).data as Record<
    string,
    unknown
  >;

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  if (created.length) await db.from('services').delete().in('id', created);
  await admin.release();
});

async function svc(over: Record<string, unknown> = {}) {
  const s = await makeService({
    provider_name: `PEAKERR secret ${randomUUID().slice(0, 6)}`,
    ...over,
  });
  created.push(s.id);
  return s;
}

describe('colonnes de textes sur services', () => {
  it('les quatre colonnes custom_* et les descriptions générées existent, nullables, vides par défaut', async () => {
    const s = await svc();
    const { data, error } = await db
      .from('services')
      .select([...CUSTOM, 'description_fr', 'description_en'].join(', '))
      .eq('id', s.id)
      .single();
    expect(error).toBeNull();
    for (const v of Object.values(data as unknown as Record<string, unknown>)) expect(v).toBeNull();
  });

  it('la vue services_public expose ces colonnes et jamais jap_name ni provider_name', async () => {
    const s = await svc({
      custom_name_fr: 'Nom perso',
      custom_description_en: 'Custom text',
      description_fr: 'Générée',
    });
    const row = await pub(s.id);
    expect(row).toMatchObject({
      custom_name_fr: 'Nom perso',
      custom_description_en: 'Custom text',
      description_fr: 'Générée',
      custom_name_en: null,
    });
    for (const k of CUSTOM) expect(row).toHaveProperty(k);
    for (const k of [
      'jap_name',
      'provider_name',
      'cost_usd_1000',
      'multiplier',
      'provider_order_id',
    ])
      expect(row).not.toHaveProperty(k);
    expect(JSON.stringify(row)).not.toMatch(/peakerr/i);
  });
});

describe('update_service : textes personnalisés', () => {
  it('accepte les quatre champs, les écrit et trace l ancienne valeur dans audit_log', async () => {
    const s = await svc({ custom_name_fr: 'Ancien nom' });
    const { error } = await update(s.id, {
      custom_name_fr: 'Nouveau nom',
      custom_name_en: 'New name',
      custom_description_fr: 'Nouvelle description',
      custom_description_en: 'New description',
    });
    expect(error).toBeNull();
    const { data } = await db.from('services').select('*').eq('id', s.id).single();
    expect(data).toMatchObject({
      custom_name_fr: 'Nouveau nom',
      custom_name_en: 'New name',
      custom_description_fr: 'Nouvelle description',
      custom_description_en: 'New description',
    });
    const [log] = await auditRows('update_service', String(s.id));
    expect(log!.details).toMatchObject({
      changes: {
        custom_name_fr: { old: 'Ancien nom', new: 'Nouveau nom' },
        custom_description_en: { old: null, new: 'New description' },
      },
    });
  });

  it('un texte vide remet la valeur à null (retour au texte généré)', async () => {
    const s = await svc({ custom_description_fr: 'Perso' });
    const { error } = await update(s.id, { custom_description_fr: '   ' });
    expect(error).toBeNull();
    expect((await pub(s.id)).custom_description_fr).toBeNull();
  });

  it('refuse un texte trop long (plus de 400 caractères) et ne change rien', async () => {
    const s = await svc();
    const { error } = await update(s.id, { custom_description_fr: 'x'.repeat(401) });
    expect(error?.message).toMatch(/INVALID_FIELD/);
    expect((await pub(s.id)).custom_description_fr).toBeNull();
  });

  it('refuse un non-admin', async () => {
    const s = await svc();
    const { error } = await db.rpc('update_service', {
      p_service: s.id,
      p_admin: randomUUID(),
      p_changes: { custom_name_fr: 'Pirate' },
    });
    expect(error).not.toBeNull();
    expect((await pub(s.id)).custom_name_fr).toBeNull();
  });
});

describe('synchronisation : ne touche jamais aux textes personnalisés', () => {
  it('conserve les quatre custom_* après une synchro qui change nom et coût fournisseur', async () => {
    const s = await svc({
      custom_name_fr: 'Perso FR',
      custom_name_en: 'Perso EN',
      custom_description_fr: 'Desc FR',
      custom_description_en: 'Desc EN',
      provider_name: 'TikTok Likes [30 Days Refill]',
    });
    const store = createSupabaseCatalogStore();
    const only = {
      ...store,
      listServices: async () => (await store.listServices()).filter((x) => x.id === s.id),
    };
    await syncServices({
      store: only,
      provider: {
        services: async () => [
          {
            service: s.id,
            name: 'TikTok Likes [Real] [90 Days Refill] [Day 50K]',
            type: 'Default',
            rate: 0.9,
            min: 10,
            max: 20000,
            dripfeed: false,
            refill: true,
            cancel: true,
            category: 'TikTok Likes',
          },
        ],
      },
    });
    const { data } = await db.from('services').select('*').eq('id', s.id).single();
    expect(data).toMatchObject({
      custom_name_fr: 'Perso FR',
      custom_name_en: 'Perso EN',
      custom_description_fr: 'Desc FR',
      custom_description_en: 'Desc EN',
      max_qty: 20000,
    });
  });
});

describe('synchronisation : recalcul des noms des services déjà en base', () => {
  it('recalcule name_fr et name_en avec le générateur actuel, sans toucher aux custom_*', async () => {
    const s = await svc({
      custom_name_fr: 'Perso FR',
      custom_name_en: 'Perso EN',
      name_fr: 'Ancien nom FR',
      name_en: 'Old name EN',
      provider_name: 'TikTok Likes [Real] [Day 50K]',
    });
    const store = createSupabaseCatalogStore();
    const only = {
      ...store,
      listServices: async () => (await store.listServices()).filter((x) => x.id === s.id),
    };
    await syncServices({
      store: only,
      provider: {
        services: async () => [
          {
            service: s.id,
            name: 'TikTok Likes [Real] [Day 50K]',
            type: 'Default',
            rate: 0.9,
            min: 10,
            max: 20000,
            dripfeed: false,
            refill: false,
            cancel: false,
            category: 'TikTok Likes',
          },
        ],
      },
    });
    const { data } = await db.from('services').select('*').eq('id', s.id).single();
    expect(data!.name_fr).toContain('50K/jour');
    expect(data!.name_fr).not.toBe('Ancien nom FR');
    expect(data!.name_en).toContain('50K/day');
    expect(data!.custom_name_fr).toBe('Perso FR');
    expect(data!.custom_name_en).toBe('Perso EN');
  });
});

describe('texte affiché au client', () => {
  it('un texte personnalisé est utilisé à la place du texte généré, jamais le nom fournisseur', async () => {
    const s = await svc({
      custom_name_en: 'My custom name',
      custom_description_en: 'My custom description',
      description_en: 'Generated',
    });
    const row = (await pub(s.id)) as unknown as PublicServiceRow;
    const p = toPublicService(row, { currency: 'XAF', locale: 'en', usdXafRate: 600 });
    expect(p.name).toBe('My custom name');
    expect((p as unknown as { description: string }).description).toBe('My custom description');
    expect(JSON.stringify(p)).not.toMatch(/peakerr/i);
  });
});
