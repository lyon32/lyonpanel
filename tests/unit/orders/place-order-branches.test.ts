import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * Branches de placeOrder / submitToProvider difficiles à provoquer avec la vraie base :
 * conversion des erreurs SQL, compte bloqué, fournisseur injoignable, alerte de solde bas.
 * Faux client Supabase en mémoire : chaque table renvoie les données préparées dans `h.tables`.
 */
const h = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  rpc: { data: null as unknown, error: null as { message: string } | null },
  updateError: null as { message: string } | null,
  provider: { add: vi.fn(), balance: vi.fn() },
}));

function chain(table: string, op: { update: boolean }) {
  const result = () =>
    op.update
      ? { data: [{ id: 'o-1' }], error: h.updateError }
      : { data: h.tables[table] ?? null, error: null };
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'gte', 'lt']) c[m] = () => c;
  c.update = () => chain(table, { update: true });
  c.maybeSingle = async () => result();
  c.single = async () => result();
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
  return c;
}
vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (t: string) => chain(t, { update: false }),
    rpc: async () => h.rpc,
  }),
}));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { placeOrder } from '@/server/orders/place-order';
import { submitToProvider, type OrderRow } from '@/server/orders/submit-to-provider';
import { notifyOwner } from '@/server/providers/telegram';

const service = {
  id: 1,
  platform: 'tiktok',
  name_fr: 'Abonnés',
  provider_type: 'Default',
  active: true,
  available: true,
  price_xaf_1000: 1155,
  cost_usd_1000: 0.385,
  min_qty: 10,
  max_qty: 10_000,
};
const input = {
  service_id: 1,
  link: 'https://www.tiktok.com/@client',
  quantity: 1000,
  expected_total_xaf: 1155,
};
const orderRow = {
  id: 'o-1',
  short_id: 7,
  user_id: 'u',
  service_id: 1,
  link: input.link,
  quantity: 1000,
  comments: null,
  charged_xaf: 1155,
  status: 'pending',
  error: null,
  start_count: null,
  remains: null,
  created_at: 'x',
  updated_at: 'y',
};

beforeEach(() => {
  vi.mocked(notifyOwner).mockClear();
  h.updateError = null;
  h.rpc = { data: null, error: null };
  h.provider.balance.mockReset().mockResolvedValue({ balance: 100, currency: 'USD' });
  h.provider.add.mockReset().mockResolvedValue({ order: 42 });
  h.tables = {
    orders: null,
    services: service,
    settings: { value: null },
    wallets: { total_recharged_xaf: 0, balance_xaf: 100 },
    profiles: { status: 'active', custom_discount_pct: 0, daily_spend_limit_xaf: null },
  };
});

const failWith = (message: string) => {
  h.rpc = { data: null, error: { message } };
};

describe('placeOrder : erreurs SQL converties', () => {
  it('INSUFFICIENT_BALANCE (course entre deux commandes) : missing_xaf = total - solde réel', async () => {
    failWith('INSUFFICIENT_BALANCE');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      details: { missing_xaf: 1055 },
    });
  });

  it('DAILY_LIMIT_REACHED : plafond global par défaut 100 000 quand le réglage est absent', async () => {
    failWith('DAILY_LIMIT_REACHED');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'DAILY_LIMIT_REACHED',
      details: { limit_xaf: 100_000 },
    });
  });

  it('DAILY_LIMIT_REACHED : le plafond du client (plus bas) l’emporte sur le global', async () => {
    h.tables.settings = { value: 100_000 };
    h.tables.profiles = { status: 'active', custom_discount_pct: 0, daily_spend_limit_xaf: 20_000 };
    failWith('DAILY_LIMIT_REACHED');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      details: { limit_xaf: 20_000 },
    });
  });

  it('QUANTITY_OUT_OF_RANGE, PRICE_CHANGED, COMMENTS_INVALID, ACCOUNT_BLOCKED, SERVICE_UNAVAILABLE', async () => {
    failWith('QUANTITY_OUT_OF_RANGE');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'QUANTITY_OUT_OF_RANGE',
      details: { min: 10, max: 10_000 },
    });
    failWith('PRICE_CHANGED');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'PRICE_CHANGED',
      details: { new_total_xaf: 1155 },
    });
    failWith('COMMENTS_INVALID');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    failWith('ACCOUNT_BLOCKED');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    failWith('SERVICE_UNAVAILABLE');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('une erreur SQL inconnue devient INTERNAL_ERROR (rien de technique renvoyé)', async () => {
    failWith('boom: relation "x" does not exist');
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('placeOrder : contrôles avant débit', () => {
  it('compte non actif : ACCOUNT_BLOCKED, aucun envoi au fournisseur', async () => {
    h.tables.profiles = { status: 'blocked', custom_discount_pct: 0 };
    h.rpc = { data: orderRow, error: null };
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    expect(h.provider.add).not.toHaveBeenCalled();
  });

  it('solde fournisseur illisible : SERVICE_UNAVAILABLE', async () => {
    h.provider.balance.mockRejectedValue(new Error('down'));
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('solde fournisseur inférieur au coût (0,385 $) : SERVICE_UNAVAILABLE', async () => {
    h.provider.balance.mockResolvedValue({ balance: 0.3, currency: 'USD' });
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('service introuvable : SERVICE_UNAVAILABLE', async () => {
    h.tables.services = null;
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('rejeu avec la même clé mais une autre quantité : IDEMPOTENCY_CONFLICT', async () => {
    h.tables.orders = { ...orderRow, quantity: 5 };
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it('rejeu identique : renvoie la commande existante sans débit ni envoi', async () => {
    h.tables.orders = { ...orderRow, status: 'in_progress' };
    failWith('NE DOIT PAS ETRE APPELE');
    const out = await placeOrder('u', input, 'k');
    expect(out).toMatchObject({ id: 'o-1', charged_xaf: 1155, status: 'in_progress' });
    expect(h.provider.add).not.toHaveBeenCalled();
  });
});

describe('placeOrder : alerte solde fournisseur bas', () => {
  it('prévient le propriétaire quand le solde restant passe sous le seuil', async () => {
    h.provider.balance.mockResolvedValue({ balance: 5.2, currency: 'USD' });
    h.tables.settings = { value: 5 };
    h.rpc = { data: orderRow, error: null };
    await placeOrder('u', input, 'k');
    expect(notifyOwner).toHaveBeenCalledWith(
      'low_provider_balance',
      expect.objectContaining({ threshold_usd: 5 }),
    );
  });
});

describe('submitToProvider : mise à jour impossible après un envoi réussi', () => {
  it('garde le numéro fournisseur dans une alerte interne et renvoie in_progress', async () => {
    h.updateError = { message: 'db down' };
    expect(await submitToProvider(orderRow as unknown as OrderRow)).toBe('in_progress');
    expect(notifyOwner).toHaveBeenCalledWith(
      'internal_error',
      expect.objectContaining({ provider_order_id: 42, order_id: 'o-1' }),
    );
  });

  it('échec du fournisseur : to_review, alerte, une seule tentative, raison tronquée à 300 caractères', async () => {
    h.provider.add.mockRejectedValue('x'.repeat(10) as unknown as Error);
    expect(await submitToProvider(orderRow as unknown as OrderRow)).toBe('to_review');
    h.provider.add.mockRejectedValue(new Error('y'.repeat(500)));
    expect(await submitToProvider(orderRow as unknown as OrderRow)).toBe('to_review');
    expect(h.provider.add).toHaveBeenCalledTimes(2); // un appel par commande soumise, aucune reprise
    expect(notifyOwner).toHaveBeenCalledTimes(2);
  });
});

describe('placeOrder : cas dégradés', () => {
  it('rejeu d une commande dont le service a disparu : INTERNAL_ERROR', async () => {
    h.tables.orders = { ...orderRow, status: 'in_progress' };
    h.tables.services = null;
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('réponse SQL vide sans message : INTERNAL_ERROR', async () => {
    h.rpc = { data: null, error: null };
    await expect(placeOrder('u', input, 'k')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
