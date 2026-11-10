import { describe, expect, it } from 'vitest';
import { computeDiscountedTotalXaf } from '@/server/pricing/compute-discounted-total';
import { computeOrderTotalXaf } from '@/server/pricing/compute-price';

describe('computeDiscountedTotalXaf', () => {
  it('sans remise : 1155 XAF les 1000, identique à computeOrderTotalXaf', () => {
    expect(computeDiscountedTotalXaf(1155, 1000, 0)).toBe(1155);
    expect(computeDiscountedTotalXaf(1155, 1000, 0)).toBe(computeOrderTotalXaf(1155, 1000));
  });

  it('remise 10 % sur 1155 : 1039,5 arrondi au multiple de 5 supérieur = 1040', () => {
    expect(computeDiscountedTotalXaf(1155, 1000, 10)).toBe(1040);
  });

  it('remise 15 % sur 1000 : 850', () => {
    expect(computeDiscountedTotalXaf(1000, 1000, 15)).toBe(850);
  });

  it('un total pile sur un multiple de 5 ne saute pas au suivant', () => {
    expect(computeDiscountedTotalXaf(1000, 1000, 0)).toBe(1000);
    expect(computeDiscountedTotalXaf(5000, 2, 0)).toBe(10);
  });

  it('minimum 5 XAF, même avec 100 % de remise', () => {
    expect(computeDiscountedTotalXaf(1, 1, 0)).toBe(5);
    expect(computeDiscountedTotalXaf(1000, 1000, 100)).toBe(5);
  });

  it('accepte les remises décimales 12,5 % et 0,5 %', () => {
    expect(computeDiscountedTotalXaf(1000, 1000, 12.5)).toBe(875);
    expect(computeDiscountedTotalXaf(1000, 1000, 0.5)).toBe(995);
  });

  it('grands nombres sans perte de précision', () => {
    // 8 709 120 × 2 000 000 × 0,9 / 1000 = 15 676 416 000 (exact)
    expect(computeDiscountedTotalXaf(8_709_120, 2_000_000, 10)).toBe(15_676_416_000);
  });

  it.each([
    ['prix zéro', 0, 10, 0],
    ['prix négatif', -1, 10, 0],
    ['prix décimal', 1.5, 10, 0],
    ['prix NaN', NaN, 10, 0],
    ['quantité zéro', 1000, 0, 0],
    ['quantité négative', 1000, -5, 0],
    ['quantité décimale', 1000, 1.5, 0],
    ['quantité NaN', 1000, NaN, 0],
    ['remise négative', 1000, 10, -1],
    ['remise supérieure à 100', 1000, 10, 101],
    ['remise NaN', 1000, 10, NaN],
  ])('refuse une entrée invalide : %s', (_nom, price, qty, pct) => {
    expect(() => computeDiscountedTotalXaf(price, qty, pct)).toThrow();
  });
});
