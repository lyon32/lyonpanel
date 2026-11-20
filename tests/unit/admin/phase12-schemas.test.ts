import { describe, expect, it } from 'vitest';

/*
 * Validation Zod des entrées admin de la phase 12 (SECURITY_NOTES §3). Modules et noms attendus :
 *   src/server/schemas/admin-orders.ts   : refundOrderSchema { amount_xaf, reason }, closeOrderSchema { reason },
 *                                          cancelOrderSchema { reason }, resendOrderSchema { confirm_verified: true, reason }
 *   src/server/schemas/admin-services.ts : patchServiceSchema { active?, name_fr?, name_en?, multiplier?, sort_order?, confirm? },
 *                                          previewServiceSchema { multiplier }
 *   src/server/schemas/admin-settings.ts : patchSettingsSchema (strict : toute clé inconnue est refusée)
 *   src/server/schemas/admin-tickets.ts  : ticketReplySchema { body }, patchTicketSchema { status: 'open' | 'closed' }
 * Tous les schémas sont stricts (champ inconnu = refus).
 */
type Schema = { safeParse: (v: unknown) => { success: boolean } };
const schema = async (file: string, name: string): Promise<Schema> => {
  const mod = (await import(/* @vite-ignore */ `@/server/schemas/${file}`)) as Record<
    string,
    Schema
  >;
  const s = mod[name];
  if (!s) throw new Error(`${file} n'exporte pas ${name}`);
  return s;
};
const ok = async (file: string, name: string, v: unknown) =>
  (await schema(file, name)).safeParse(v).success;

describe('refundOrderSchema', () => {
  const f = 'admin-orders';
  it('accepte un montant entier positif et un motif', async () => {
    expect(
      await ok(f, 'refundOrderSchema', {
        amount_xaf: 500,
        reason: 'Commande échouée chez le fournisseur',
      }),
    ).toBe(true);
  });
  it.each([0, -1, 1.5, Number.NaN, Infinity, '500', null, 10_000_000_000])(
    'refuse le montant %j',
    async (amount) => {
      expect(await ok(f, 'refundOrderSchema', { amount_xaf: amount, reason: 'motif valide' })).toBe(
        false,
      );
    },
  );
  it.each([undefined, '', '   ', 'a', 'x'.repeat(501)])(
    'refuse le motif %j (obligatoire, borné)',
    async (reason) => {
      expect(await ok(f, 'refundOrderSchema', { amount_xaf: 500, reason })).toBe(false);
    },
  );
  it('refuse un champ inconnu (ex. user_id) : aucune injection de paramètre', async () => {
    expect(
      await ok(f, 'refundOrderSchema', { amount_xaf: 500, reason: 'motif valide', user_id: 'x' }),
    ).toBe(false);
  });
});

describe('closeOrderSchema et cancelOrderSchema', () => {
  it.each(['closeOrderSchema', 'cancelOrderSchema'])('%s : motif obligatoire', async (name) => {
    expect(await ok('admin-orders', name, { reason: 'Vérifié chez le fournisseur' })).toBe(true);
    expect(await ok('admin-orders', name, {})).toBe(false);
    expect(await ok('admin-orders', name, { reason: '  ' })).toBe(false);
  });
});

describe('resendOrderSchema', () => {
  const f = 'admin-orders';
  const reason = 'Rien envoyé chez le fournisseur';
  it('exige la case « j’ai vérifié » à true', async () => {
    expect(await ok(f, 'resendOrderSchema', { confirm_verified: true, reason })).toBe(true);
  });
  it.each([false, undefined, 'true', 1, null])('refuse confirm_verified = %j', async (c) => {
    expect(await ok(f, 'resendOrderSchema', { confirm_verified: c, reason })).toBe(false);
  });
  it('exige aussi un motif', async () => {
    expect(await ok(f, 'resendOrderSchema', { confirm_verified: true })).toBe(false);
  });
});

describe('patchServiceSchema et previewServiceSchema', () => {
  const f = 'admin-services';
  it('accepte un changement valide', async () => {
    expect(
      await ok(f, 'patchServiceSchema', {
        active: false,
        name_fr: 'Abonnés TikTok',
        name_en: 'TikTok followers',
        multiplier: 3.2,
        sort_order: 4,
      }),
    ).toBe(true);
  });
  it.each([0, -1, 51, Number.NaN, '3', Infinity])('refuse le multiplicateur %j', async (m) => {
    expect(await ok(f, 'patchServiceSchema', { multiplier: m })).toBe(false);
    expect(await ok(f, 'previewServiceSchema', { multiplier: m })).toBe(false);
  });
  it.each(['', '   ', 'x'.repeat(201)])('refuse le nom %j', async (name) => {
    expect(await ok(f, 'patchServiceSchema', { name_fr: name })).toBe(false);
  });
  it('refuse un champ qui ne se change pas ici (coût, prix, id, nom du fournisseur)', async () => {
    for (const k of ['cost_usd_1000', 'price_xaf_1000', 'id', 'provider_name']) {
      expect(await ok(f, 'patchServiceSchema', { [k]: 1 }), k).toBe(false);
    }
  });
  it('refuse un ordre d’affichage non entier', async () => {
    expect(await ok(f, 'patchServiceSchema', { sort_order: 1.5 })).toBe(false);
  });
});

describe('patchSettingsSchema', () => {
  const f = 'admin-settings';
  it('accepte des valeurs raisonnables', async () => {
    expect(
      await ok(f, 'patchSettingsSchema', {
        usd_xaf_rate: 600,
        default_multiplier: 3,
        min_recharge_xaf: 500,
        referral_pct: 5,
        provider_low_balance_usd: 5,
        price_alert_pct: 20,
        auto_discount: { threshold_xaf: 50000, pct: 10 },
      }),
    ).toBe(true);
  });
  it.each([
    ['usd_xaf_rate', 0],
    ['usd_xaf_rate', -600],
    ['usd_xaf_rate', 1_000_000],
    ['usd_xaf_rate', '600'],
    ['default_multiplier', 0],
    ['default_multiplier', 1000],
    ['min_recharge_xaf', -1],
    ['min_recharge_xaf', 1.5],
    ['referral_pct', -1],
    ['referral_pct', 101],
    ['provider_low_balance_usd', -1],
    ['price_alert_pct', 0],
    ['price_alert_pct', 1000],
  ])('refuse %s = %j', async (key, value) => {
    expect(await ok(f, 'patchSettingsSchema', { [key]: value })).toBe(false);
  });
  it('refuse une remise automatique hors bornes', async () => {
    expect(
      await ok(f, 'patchSettingsSchema', { auto_discount: { threshold_xaf: 50000, pct: 101 } }),
    ).toBe(false);
    expect(
      await ok(f, 'patchSettingsSchema', { auto_discount: { threshold_xaf: -1, pct: 10 } }),
    ).toBe(false);
  });
  it.each([
    'saspay_api_key',
    'provider_api_key',
    'service_role_key',
    'telegram_bot_token',
    'nimporte',
  ])('refuse la clé inconnue ou secrète %s', async (key) => {
    expect(await ok(f, 'patchSettingsSchema', { [key]: 'valeur' })).toBe(false);
  });
  it('refuse un objet vide (rien à changer)', async () => {
    expect(await ok(f, 'patchSettingsSchema', {})).toBe(false);
  });
});

describe('schémas de tickets admin', () => {
  it('ticketReplySchema : texte non vide et borné', async () => {
    expect(await ok('admin-tickets', 'ticketReplySchema', { body: 'Bonjour, c’est réglé.' })).toBe(
      true,
    );
    expect(await ok('admin-tickets', 'ticketReplySchema', { body: '  ' })).toBe(false);
    expect(await ok('admin-tickets', 'ticketReplySchema', { body: 'x'.repeat(5001) })).toBe(false);
  });
  it('patchTicketSchema : seulement open ou closed (« answered » vient de la réponse)', async () => {
    expect(await ok('admin-tickets', 'patchTicketSchema', { status: 'closed' })).toBe(true);
    expect(await ok('admin-tickets', 'patchTicketSchema', { status: 'open' })).toBe(true);
    expect(await ok('admin-tickets', 'patchTicketSchema', { status: 'answered' })).toBe(false);
    expect(await ok('admin-tickets', 'patchTicketSchema', { status: 'deleted' })).toBe(false);
  });
});
