import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { computeQuote } from '@/server/payments/quote';

// Module attendu : src/server/payments/quote.ts
//   computeQuote(amountXaf, { minRechargeXaf, maxRechargeXaf, feePct }) -> { amountXaf, feeXaf, totalToPay }
//   frais = arrondi à l'entier supérieur de montant × feePct / 100 ; total = montant + frais (mode ADD_ON)
//   sous le minimum -> ApiError AMOUNT_BELOW_MINIMUM (details.min_xaf) ; au-dessus du maximum -> INVALID_AMOUNT (details.max_xaf)
//   quotePayment(amountXaf) : même chose, avec les réglages min_recharge_xaf, max_recharge_xaf, saspay_fee_pct (testé en base)

const RULES = { minRechargeXaf: 500, maxRechargeXaf: 500_000, feePct: 3 };

describe('computeQuote', () => {
  it('3 000 XAF à 3 % : 90 XAF de frais, 3 090 XAF à payer', () => {
    expect(computeQuote(3000, RULES)).toEqual({ amountXaf: 3000, feeXaf: 90, totalToPay: 3090 });
  });

  it('accepte le minimum exact (500 XAF -> 15 XAF de frais)', () => {
    expect(computeQuote(500, RULES)).toEqual({ amountXaf: 500, feeXaf: 15, totalToPay: 515 });
  });

  it('accepte le maximum exact (500 000 XAF -> 15 000 XAF de frais)', () => {
    expect(computeQuote(500_000, RULES)).toEqual({
      amountXaf: 500_000,
      feeXaf: 15_000,
      totalToPay: 515_000,
    });
  });

  it('arrondit les frais à l entier supérieur (1 001 XAF -> 31 XAF)', () => {
    expect(computeQuote(1001, RULES).feeXaf).toBe(31);
  });

  it('ne produit que des entiers XAF', () => {
    for (const amount of [500, 777, 1001, 2999, 12_345, 499_999]) {
      const q = computeQuote(amount, RULES);
      expect(Number.isInteger(q.feeXaf)).toBe(true);
      expect(q.totalToPay).toBe(q.amountXaf + q.feeXaf);
    }
  });

  it('refuse 499 XAF avec AMOUNT_BELOW_MINIMUM et le minimum en détail', () => {
    expect(() => computeQuote(499, RULES)).toThrowError(
      expect.objectContaining({ code: 'AMOUNT_BELOW_MINIMUM', details: { min_xaf: 500 } }),
    );
  });

  it('refuse 500 001 XAF', () => {
    expect(() => computeQuote(500_001, RULES)).toThrowError(
      expect.objectContaining({ code: 'INVALID_AMOUNT', details: { max_xaf: 500_000 } }),
    );
  });

  it('lit les bornes dans les réglages : un minimum de 1 000 refuse 999', () => {
    const custom = { ...RULES, minRechargeXaf: 1000 };
    expect(() => computeQuote(999, custom)).toThrowError(
      expect.objectContaining({ code: 'AMOUNT_BELOW_MINIMUM', details: { min_xaf: 1000 } }),
    );
    expect(computeQuote(1000, custom).amountXaf).toBe(1000);
  });

  it('lit le pourcentage de frais dans les réglages (5 % de 3 000 = 150)', () => {
    expect(computeQuote(3000, { ...RULES, feePct: 5 }).feeXaf).toBe(150);
  });

  it.each([0, -1000, 3000.5, Number.NaN])('refuse le montant invalide %s', (amount) => {
    expect(() => computeQuote(amount, RULES)).toThrowError(
      expect.objectContaining({
        code: expect.stringMatching(/^(INVALID_AMOUNT|AMOUNT_BELOW_MINIMUM)$/),
      }),
    );
  });
});
