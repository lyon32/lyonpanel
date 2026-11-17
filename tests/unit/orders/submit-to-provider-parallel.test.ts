import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * Commandes envoyées en parallèle : chaque ligne `orders` reçoit le numéro fournisseur
 * de SA propre réponse, même si les réponses arrivent dans le désordre.
 */
const h = vi.hoisted(() => ({
  updates: [] as { id: string; patch: Record<string, unknown> }[],
}));

vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          h.updates.push({ id, patch });
          return { error: null };
        },
      }),
    }),
  }),
}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
// Le faux fournisseur répond avec un numéro dérivé du lien, après un délai aléatoire.
vi.mock('@/server/providers', () => ({
  getProvider: () => ({
    add: async ({ link }: { link: string }) => {
      await new Promise((r) => setTimeout(r, Math.random() * 40));
      return { order: 81_000_000 + Number(link.split('/').pop()) };
    },
  }),
}));

import { submitToProvider, type OrderRow } from '@/server/orders/submit-to-provider';

describe('submitToProvider en parallèle', () => {
  it('garde le numéro fournisseur propre à chaque commande, sans doublon', async () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      id: `order-${i}`,
      short_id: String(i),
      service_id: 1,
      link: `https://example.com/p/${i}`,
      quantity: 100,
      comments: null,
      charged_xaf: 500,
      user_id: `user-${i % 2}`,
    })) as unknown as OrderRow[];

    const results = await Promise.all(orders.map((o) => submitToProvider(o)));

    expect(results.every((r) => r === 'in_progress')).toBe(true);
    expect(h.updates).toHaveLength(10);
    for (const { id, patch } of h.updates) {
      expect(patch.provider_order_id).toBe(81_000_000 + Number(id.split('-')[1]));
    }
    expect(new Set(h.updates.map((u) => u.patch.provider_order_id)).size).toBe(10);
  });
});
