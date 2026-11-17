import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => ({
  balance: vi.fn(),
  inserted: [] as unknown[],
  threshold: 5 as unknown,
}));
vi.mock('@/server/providers', () => ({ getProvider: () => ({ balance: h.balance }) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (t: string) =>
      t === 'provider_balance_snapshots'
        ? {
            insert: async (row: unknown) => {
              h.inserted.push(row);
              return { error: null };
            },
          }
        : {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { value: h.threshold } }) }),
            }),
          },
  }),
}));

import { recordProviderBalance } from '@/server/providers/record-provider-balance';
import { notifyOwner } from '@/server/providers/telegram';

beforeEach(() => {
  h.inserted.length = 0;
  h.threshold = 5;
  vi.mocked(notifyOwner).mockClear();
});

describe('recordProviderBalance', () => {
  it('enregistre le solde et ne prévient pas au dessus du seuil', async () => {
    h.balance.mockResolvedValue({ balance: 42.5, currency: 'USD' });
    await expect(recordProviderBalance()).resolves.toEqual({ balanceUsd: 42.5, alerted: false });
    expect(h.inserted).toEqual([{ balance_usd: 42.5 }]);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it('prévient le propriétaire sous le seuil de 5 $', async () => {
    h.balance.mockResolvedValue({ balance: 3.2, currency: 'USD' });
    await expect(recordProviderBalance()).resolves.toMatchObject({ alerted: true });
    expect(notifyOwner).toHaveBeenCalledWith('low_provider_balance', {
      balance_usd: 3.2,
      threshold_usd: 5,
    });
  });

  it('fournisseur injoignable : l erreur remonte, rien n est enregistré', async () => {
    h.balance.mockRejectedValue(new Error('PROVIDER_ERROR'));
    await expect(recordProviderBalance()).rejects.toThrow();
    expect(h.inserted).toHaveLength(0);
  });
});
