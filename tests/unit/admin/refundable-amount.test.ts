import { describe, expect, it } from 'vitest';

/*
 * Montant remboursable d'une commande (phase 12, décision 2) : la part NON LIVRÉE, en entiers XAF.
 * Signature attendue (src/server/admin/refunds.ts) :
 *   refundableAmountXaf(input: { chargedXaf: number; quantity: number; remains: number; refundedXaf: number }): number
 * Règle : arrondi vers le BAS (jamais plus que le dû), moins ce qui a déjà été rendu, jamais négatif, jamais plus que le payé.
 */
type Input = { chargedXaf: number; quantity: number; remains: number; refundedXaf: number };
type Fn = (i: Input) => number;
const refundable = async (i: Input): Promise<number> => {
  const path = '@/server/admin/refunds';
  const mod = (await import(/* @vite-ignore */ path)) as {
    refundableAmountXaf: Fn;
  };
  return mod.refundableAmountXaf(i);
};
const base: Input = { chargedXaf: 5000, quantity: 5000, remains: 2000, refundedXaf: 0 };

describe('refundableAmountXaf', () => {
  it('payé 5 000, 3 000 déjà consommés : rend 2 000', async () => {
    expect(await refundable(base)).toBe(2000);
  });

  it('600 livrés sur 1 000 : rend la part des 400 restants', async () => {
    expect(
      await refundable({ chargedXaf: 1000, quantity: 1000, remains: 400, refundedXaf: 0 }),
    ).toBe(400);
  });

  it('arrondit vers le bas : 1 155 XAF, 333 restants sur 1 000 = 384 (et non 385)', async () => {
    expect(
      await refundable({ chargedXaf: 1155, quantity: 1000, remains: 333, refundedXaf: 0 }),
    ).toBe(384);
  });

  it('rien livré : rend tout le payé', async () => {
    expect(
      await refundable({ chargedXaf: 1155, quantity: 1000, remains: 1000, refundedXaf: 0 }),
    ).toBe(1155);
  });

  it('tout livré : rend 0', async () => {
    expect(await refundable({ ...base, remains: 0 })).toBe(0);
  });

  it('déduit ce qui a déjà été rendu (somme cumulée plafonnée)', async () => {
    expect(await refundable({ ...base, refundedXaf: 500 })).toBe(1500);
  });

  it('jamais négatif quand tout le dû est déjà rendu ou dépassé', async () => {
    expect(await refundable({ ...base, refundedXaf: 2000 })).toBe(0);
    expect(await refundable({ ...base, refundedXaf: 9999 })).toBe(0);
  });

  it('jamais plus que le payé, même avec un reste incohérent supérieur à la quantité', async () => {
    expect(await refundable({ ...base, remains: 99_999 })).toBe(5000);
  });

  it('le résultat est toujours un entier', async () => {
    const out = await refundable({ chargedXaf: 1000, quantity: 3, remains: 1, refundedXaf: 0 });
    expect(Number.isInteger(out)).toBe(true);
    expect(out).toBe(333);
  });
});
