import { describe, expect, it } from 'vitest';
import {
  nextDiscountThresholdXaf,
  resolveDiscountPct,
} from '@/server/pricing/resolve-discount-pct';

// Fichier attendu : src/server/pricing/resolve-discount-pct.ts
//   resolveDiscountPct(totalRechargedXaf, auto: {thresholdXaf, pct}, customPct: number | null): number
//   nextDiscountThresholdXaf(totalRechargedXaf, auto, customPct): number | null
const auto = { thresholdXaf: 50_000, pct: 10 };

describe('resolveDiscountPct', () => {
  it('49 999 XAF rechargés : pas de remise', () => {
    expect(resolveDiscountPct(49_999, auto, null)).toBe(0);
  });

  it('50 000 XAF rechargés : 10 % (seuil inclus)', () => {
    expect(resolveDiscountPct(50_000, auto, null)).toBe(10);
  });

  it('au-dessus du seuil : toujours 10 %', () => {
    expect(resolveDiscountPct(1_000_000, auto, null)).toBe(10);
  });

  it('personnalisée 15 % contre auto 10 % : 15, jamais 25', () => {
    expect(resolveDiscountPct(60_000, auto, 15)).toBe(15);
  });

  it('personnalisée 5 % contre auto 10 % : 10, jamais 15', () => {
    expect(resolveDiscountPct(60_000, auto, 5)).toBe(10);
  });

  it('personnalisée seule sous le seuil : elle s applique', () => {
    expect(resolveDiscountPct(1_000, auto, 12.5)).toBe(12.5);
  });

  it('personnalisée 0 ou nulle : valeur auto', () => {
    expect(resolveDiscountPct(60_000, auto, 0)).toBe(10);
    expect(resolveDiscountPct(0, auto, null)).toBe(0);
  });
});

describe('nextDiscountThresholdXaf', () => {
  it('sous le seuil : renvoie 50 000', () => {
    expect(nextDiscountThresholdXaf(0, auto, null)).toBe(50_000);
    expect(nextDiscountThresholdXaf(49_999, auto, null)).toBe(50_000);
  });

  it('seuil atteint (50 000 pile) : null', () => {
    expect(nextDiscountThresholdXaf(50_000, auto, null)).toBeNull();
    expect(nextDiscountThresholdXaf(80_000, auto, null)).toBeNull();
  });

  it('personnalisée >= auto : null (la barre n aurait pas de sens)', () => {
    expect(nextDiscountThresholdXaf(1_000, auto, 10)).toBeNull();
    expect(nextDiscountThresholdXaf(1_000, auto, 20)).toBeNull();
  });

  it('personnalisée inférieure à auto : le palier reste proposé', () => {
    expect(nextDiscountThresholdXaf(1_000, auto, 5)).toBe(50_000);
  });
});
