import { randomUUID } from 'node:crypto';
import { afterAll, vi } from 'vitest';
import { adminClient } from '../db/helpers/client';
import { makeService } from '../factories/service';
import { makeUser, removeUser, type TestUser } from '../factories/user';
import type { ProviderApi } from '@/server/providers/types';

/*
 * Aide commune des tests de commande (vraie base locale + faux fournisseur contrôlable).
 * Le faux fournisseur est injecté en remplaçant `getProvider` de '@/server/providers'
 * (voir chaque fichier : vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }))).
 */

export const TIKTOK_LINK = 'https://www.tiktok.com/@client_test/video/7300000000000000000';

/** Champs qu'un client ne doit JAMAIS voir dans une commande (coût, erreur brute, fournisseur, clé). */
export const FORBIDDEN_ORDER_KEYS = [
  'cost_usd',
  'error',
  'provider_order_id',
  'idem_key',
  'user_id',
  'service_id',
  'price_xaf_1000',
];

export type FakeProvider = ProviderApi & {
  add: ReturnType<typeof vi.fn>;
  balance: ReturnType<typeof vi.fn>;
};

// provider_order_id est unique en base et les commandes y restent : compteur global + aléa.
let providerOrderCounter = 0;
const providerOrderBase = 1_000_000 + Math.floor(Math.random() * 1_000_000_000);
export function nextProviderOrderId(): number {
  return providerOrderBase + ++providerOrderCounter;
}

/** Faux fournisseur : `add` réussit par défaut (numéro d'ordre unique), solde réglable. Aucun réseau. */
export function makeFakeProvider(balanceUsd = 100): FakeProvider {
  return {
    services: vi.fn(async () => []),
    balance: vi.fn(async () => ({ balance: balanceUsd, currency: 'USD' as const })),
    add: vi.fn(async () => ({ order: nextProviderOrderId() })),
    status: vi.fn(async () => ({})),
  } as unknown as FakeProvider;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const { error } = await adminClient().from('settings').upsert({ key, value });
  if (error) throw new Error(`réglage ${key} impossible : ${error.message}`);
}

/** Réglages de la phase 6 (décisions du 2026-11-10) ; à appeler avant chaque test. */
export async function resetOrderSettings(): Promise<void> {
  await setSetting('daily_order_cap_xaf', 100_000);
  await setSetting('provider_low_balance_usd', 5);
  await setSetting('auto_discount', { threshold_xaf: 50_000, pct: 10 });
}

/** Remet les réglages d'origine en fin de fichier (même si un test a échoué). */
export function restoreOrderSettingsAfterAll(): void {
  afterAll(resetOrderSettings);
}

/** Service TikTok « abonnés » : 1 155 XAF les 1 000, min 10, max 10 000. */
export function makeFollowersService(over: Record<string, unknown> = {}) {
  return makeService({
    platform: 'tiktok',
    category: 'followers',
    price_xaf_1000: 1155,
    cost_usd_1000: 0.385,
    min_qty: 10,
    max_qty: 10_000,
    ...over,
  });
}

export function makeCommentsService(over: Record<string, unknown> = {}) {
  return makeFollowersService({
    category: 'comments',
    provider_type: 'Custom Comments',
    name_fr: 'Commentaires personnalisés TikTok (test)',
    price_xaf_1000: 5000, // 2 commentaires = 10 XAF, 3 = 15 XAF (montants exacts)
    min_qty: 2,
    max_qty: 50,
    ...over,
  });
}

/** Client de test avec solde, total rechargé et profil réglés (écriture de préparation seulement). */
export async function makeFundedUser(
  created: string[],
  opts: { balance?: number; recharged?: number; profile?: Record<string, unknown> } = {},
): Promise<TestUser> {
  const u = await makeUser();
  created.push(u.id);
  const db = adminClient();
  const w = await db
    .from('wallets')
    .update({ balance_xaf: opts.balance ?? 0, total_recharged_xaf: opts.recharged ?? 0 })
    .eq('user_id', u.id);
  if (w.error) throw new Error(`solde de test impossible : ${w.error.message}`);
  if (opts.profile) {
    const p = await db.from('profiles').update(opts.profile).eq('id', u.id);
    if (p.error) throw new Error(`profil de test impossible : ${p.error.message}`);
  }
  return u;
}

export async function cleanupUsers(created: string[]): Promise<void> {
  while (created.length) await removeUser(created.pop()!);
}

export async function balanceOf(userId: string): Promise<number> {
  const { data } = await adminClient()
    .from('wallets')
    .select('balance_xaf')
    .eq('user_id', userId)
    .single();
  return Number(data!.balance_xaf);
}

export async function ordersOf(userId: string): Promise<Record<string, unknown>[]> {
  const { data } = await adminClient().from('orders').select('*').eq('user_id', userId);
  return (data ?? []) as Record<string, unknown>[];
}

export async function debitsOf(userId: string): Promise<Record<string, unknown>[]> {
  const { data } = await adminClient()
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'order');
  return (data ?? []) as Record<string, unknown>[];
}

export const newKey = (): string => randomUUID();
