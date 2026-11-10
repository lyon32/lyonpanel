import { describe, expect, it } from 'vitest';
import {
  computeMinOrderXaf,
  computeOrderTotalXaf,
  computePricePer1000Xaf,
} from '@/server/pricing/compute-price';

// Signatures attendues (LLD §4.1, phase 4) :
//   computePricePer1000Xaf(costUsd1000: number | string, usdXafRate: number, multiplier: number)
//       -> entier XAF, multiple de 5, minimum 5
//   computeOrderTotalXaf(pricePer1000Xaf: number, quantity: number)
//       -> entier XAF, multiple de 5, minimum 5
//   computeMinOrderXaf(pricePer1000Xaf: number, minQty: number)
//       -> total pour la quantité minimale
// Le taux et le multiplicateur sont toujours des paramètres : aucun 600 ni 3 dans le calcul.

const RATE = 600;
const X3 = 3;

describe('computePricePer1000Xaf : valeurs de référence (taux 600, ×3)', () => {
  it.each([
    [0.756, 1365],
    [1.61, 2900],
    [4.2, 7560],
    [1.008, 1815],
    [0.0012, 5],
    [4838.4, 8709120],
  ])('un coût de %s $ donne %s XAF pour 1 000', (cost, expected) => {
    expect(computePricePer1000Xaf(cost, RATE, X3)).toBe(expected);
  });

  it("accepte le coût sous forme de texte (comme l'API du fournisseur)", () => {
    expect(computePricePer1000Xaf('0.756', RATE, X3)).toBe(1365);
    expect(computePricePer1000Xaf('4838.40', RATE, X3)).toBe(8709120);
    expect(computePricePer1000Xaf('1.50', RATE, X3)).toBe(2700);
  });
});

describe('computePricePer1000Xaf : arrondi', () => {
  it('arrondit toujours au multiple de 5 supérieur', () => {
    expect(computePricePer1000Xaf(0.756, RATE, X3)).toBe(1365); // 1360.8
    expect(computePricePer1000Xaf(1.008, RATE, X3)).toBe(1815); // 1814.4
  });

  it("ne monte pas d'un cran quand le résultat est déjà un multiple de 5", () => {
    expect(computePricePer1000Xaf(0.3, RATE, X3)).toBe(540);
    expect(computePricePer1000Xaf(1, RATE, X3)).toBe(1800);
  });

  it('monte à 5 au minimum, même pour un coût nul ou presque', () => {
    expect(computePricePer1000Xaf(0.0001, RATE, X3)).toBe(5);
    expect(computePricePer1000Xaf(0, RATE, X3)).toBe(5);
  });

  it("juste au-dessus d'un multiple de 5, passe au suivant", () => {
    expect(computePricePer1000Xaf(0.0034, RATE, X3)).toBe(10); // 6.12
    expect(computePricePer1000Xaf(0.0028, RATE, X3)).toBe(10); // 5.04
    expect(computePricePer1000Xaf(0.0027, RATE, X3)).toBe(5); // 4.86
  });
});

describe('computePricePer1000Xaf : aucune erreur de virgule flottante', () => {
  it('0.1 + 0.2 vaut exactement 0.3 (540 XAF, pas 545)', () => {
    expect(computePricePer1000Xaf(0.1 + 0.2, RATE, X3)).toBe(540);
  });

  it('1.1 $ × 600 × 3 vaut exactement 1980 (pas 1985)', () => {
    expect(computePricePer1000Xaf(1.1, RATE, X3)).toBe(1980);
  });

  it('4838.4 $ donne 8 709 120 exactement', () => {
    expect(computePricePer1000Xaf(4838.4, RATE, X3)).toBe(8709120);
  });

  it('0.0012 $ reste au minimum de 5 XAF', () => {
    expect(computePricePer1000Xaf(0.0012, RATE, X3)).toBe(5);
  });

  it('un coût à 4 décimales est traité sans perte', () => {
    expect(computePricePer1000Xaf(0.0013, RATE, X3)).toBe(5); // 2.34
    expect(computePricePer1000Xaf(0.1008, RATE, X3)).toBe(185); // 181.44
  });

  it('renvoie toujours un entier multiple de 5, jamais sous le coût converti (500 coûts générés)', () => {
    for (let i = 1; i <= 500; i += 1) {
      const cost = (i * 7919) / 10_000;
      const price = computePricePer1000Xaf(cost, RATE, X3);
      expect(Number.isInteger(price), `coût ${cost}`).toBe(true);
      expect(price % 5, `coût ${cost}`).toBe(0);
      expect(price, `coût ${cost}`).toBeGreaterThanOrEqual(5);
      expect(price, `coût ${cost}`).toBeGreaterThanOrEqual(cost * RATE * X3 - 1e-6);
    }
  });
});

describe('computePricePer1000Xaf : multiplicateur et taux sont des paramètres', () => {
  it.each([
    [1, 550],
    [2, 1100],
    [5, 2750],
    [10, 5500],
  ])('multiplicateur ×%s, taux 550, coût 1 $ -> %s XAF', (mult, expected) => {
    expect(computePricePer1000Xaf(1, 550, mult)).toBe(expected);
  });

  it('un multiplicateur décimal est respecté (×2.5 sur 0.756 $ -> 1135)', () => {
    expect(computePricePer1000Xaf(0.756, RATE, 2.5)).toBe(1135); // 1134
  });

  it('un taux décimal est respecté (655.957 × 3 sur 1 $ -> 1970)', () => {
    expect(computePricePer1000Xaf(1, 655.957, X3)).toBe(1970); // 1967.871
  });

  it('changer le taux change le prix', () => {
    expect(computePricePer1000Xaf(1.61, 600, X3)).toBe(2900);
    expect(computePricePer1000Xaf(1.61, 550, X3)).toBe(2660); // 2656.5
  });

  it('changer le multiplicateur change le prix', () => {
    expect(computePricePer1000Xaf(4.2, RATE, 3)).toBe(7560);
    expect(computePricePer1000Xaf(4.2, RATE, 5)).toBe(12600);
  });
});

describe('computePricePer1000Xaf : entrées invalides', () => {
  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])('refuse le multiplicateur %s', (m) => {
    expect(() => computePricePer1000Xaf(1, RATE, m)).toThrow();
  });

  it.each([0, -600, Number.NaN, Number.POSITIVE_INFINITY])('refuse le taux %s', (r) => {
    expect(() => computePricePer1000Xaf(1, r, X3)).toThrow();
  });

  it.each([-0.01, -1, Number.NaN, Number.POSITIVE_INFINITY, 'abc', ''])(
    'refuse le coût %s',
    (c) => {
      expect(() => computePricePer1000Xaf(c, RATE, X3)).toThrow();
    },
  );
});

describe('computeOrderTotalXaf', () => {
  it('prix 1365 pour 1 000, quantité 10 -> 15 XAF', () => {
    expect(computeOrderTotalXaf(1365, 10)).toBe(15);
  });

  it('prix 1815 pour 1 000, quantité 1 000 -> 1815 XAF', () => {
    expect(computeOrderTotalXaf(1815, 1000)).toBe(1815);
  });

  it('arrondit au multiple de 5 supérieur sur une quantité non ronde (137)', () => {
    expect(computeOrderTotalXaf(1365, 137)).toBe(190); // 187.005
  });

  it("ne monte pas d'un cran quand le total est déjà un multiple de 5", () => {
    expect(computeOrderTotalXaf(1500, 1000)).toBe(1500);
    expect(computeOrderTotalXaf(2000, 5)).toBe(10);
  });

  it('ne descend jamais sous 5 XAF', () => {
    expect(computeOrderTotalXaf(1365, 1)).toBe(5);
    expect(computeOrderTotalXaf(5, 1)).toBe(5);
    expect(computeOrderTotalXaf(5, 10)).toBe(5);
  });

  it('calcule en entiers sur de très gros montants (aucune dérive)', () => {
    expect(computeOrderTotalXaf(8709120, 1_000_000)).toBe(8_709_120_000);
    expect(computeOrderTotalXaf(8709120, 1)).toBe(8710); // 8709.12
  });

  it('suit le prix reçu (jamais de prix en dur)', () => {
    expect(computeOrderTotalXaf(2730, 1000)).toBe(2 * computeOrderTotalXaf(1365, 1000));
  });

  it('renvoie un entier multiple de 5, minimum 5, sur 500 quantités', () => {
    for (let q = 1; q <= 500; q += 1) {
      const total = computeOrderTotalXaf(1815, q * 13);
      expect(Number.isInteger(total), `q=${q * 13}`).toBe(true);
      expect(total % 5, `q=${q * 13}`).toBe(0);
      expect(total, `q=${q * 13}`).toBeGreaterThanOrEqual(5);
    }
  });

  it.each([0, -1, 1.5, Number.NaN])('refuse la quantité %s', (q) => {
    expect(() => computeOrderTotalXaf(1365, q)).toThrow();
  });

  it.each([0, -5, 12.5, Number.NaN])('refuse le prix %s', (p) => {
    expect(() => computeOrderTotalXaf(p, 100)).toThrow();
  });
});

describe('computeMinOrderXaf', () => {
  it('est le total avec la quantité minimale', () => {
    expect(computeMinOrderXaf(1365, 10)).toBe(15);
    expect(computeMinOrderXaf(1815, 1000)).toBe(1815);
    expect(computeMinOrderXaf(1365, 100)).toBe(computeOrderTotalXaf(1365, 100));
  });

  it('vaut au moins 5 XAF', () => {
    expect(computeMinOrderXaf(5, 1)).toBe(5);
  });

  it('refuse une quantité minimale invalide', () => {
    expect(() => computeMinOrderXaf(1365, 0)).toThrow();
  });
});
