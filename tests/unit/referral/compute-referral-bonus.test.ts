import { describe, expect, it } from 'vitest';
import { computeReferralBonusXaf } from '@/server/pricing/compute-referral-bonus';

// Fichier attendu : src/server/pricing/compute-referral-bonus.ts
// Signature (LLD §4.1) : computeReferralBonusXaf(creditedXaf, pct) -> entier XAF, arrondi à l'inférieur.
describe('computeReferralBonusXaf', () => {
  it.each([
    [10_000, 5, 500],
    [3_000, 5, 150],
    [500_000, 5, 25_000],
  ])('5 %% de %i XAF = %i XAF', (credited, pct, expected) => {
    expect(computeReferralBonusXaf(credited, pct)).toBe(expected);
  });

  it('arrondit à l inférieur : 5 % de 3 001 = 150,05 -> 150', () => {
    expect(computeReferralBonusXaf(3_001, 5)).toBe(150);
    expect(computeReferralBonusXaf(3_019, 5)).toBe(150);
  });

  it('renvoie 0 pour un petit montant (19 XAF -> 0,95 -> 0) ou un pourcentage nul', () => {
    expect(computeReferralBonusXaf(19, 5)).toBe(0);
    expect(computeReferralBonusXaf(500, 0)).toBe(0);
  });

  it('suit le réglage : 3 % de 10 000 = 300', () => {
    expect(computeReferralBonusXaf(10_000, 3)).toBe(300);
  });

  it('renvoie toujours un entier, sans erreur de flottant', () => {
    expect(computeReferralBonusXaf(7, 5)).toBe(0);
    expect(computeReferralBonusXaf(2_999, 5)).toBe(149);
    for (const n of [1, 99, 1_001, 49_999, 123_457]) {
      expect(Number.isInteger(computeReferralBonusXaf(n, 5))).toBe(true);
    }
  });

  it('refuse un montant négatif ou non entier, et un pourcentage hors 0..100', () => {
    expect(() => computeReferralBonusXaf(-1, 5)).toThrow();
    expect(() => computeReferralBonusXaf(10.5, 5)).toThrow();
    expect(() => computeReferralBonusXaf(1000, -1)).toThrow();
    expect(() => computeReferralBonusXaf(1000, 101)).toThrow();
  });
});
