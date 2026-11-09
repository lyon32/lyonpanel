import { describe, expect, it } from 'vitest';
import { convertFromXaf, formatCatalogMoney } from '@/lib/money';

// Module attendu : src/lib/money.ts (LLD §2, partagé navigateur + serveur, sans secret)
//   convertFromXaf(amountXaf: number, currency: 'XAF' | 'XOF' | 'USD', usdXafRate: number): number
//       XAF et XOF : même valeur (parité) ; USD : XAF / taux, arrondi à 2 décimales (demi vers le haut)
//   formatCatalogMoney(amountXaf: number, currency, locale: string, usdXafRate: number): string
// Le taux vient du réglage `usd_xaf_rate` : jamais de taux écrit dans la fonction.
// L'affichage seulement : le serveur débite toujours en XAF entiers.

describe('convertFromXaf', () => {
  it('XAF et XOF gardent le même nombre (parité)', () => {
    expect(convertFromXaf(1365, 'XAF', 600)).toBe(1365);
    expect(convertFromXaf(1365, 'XOF', 600)).toBe(1365);
    expect(convertFromXaf(8709120, 'XOF', 600)).toBe(8709120);
  });

  it.each([
    [1800, 600, 3],
    [1370, 600, 2.28],
    [20, 600, 0.03],
    [5, 600, 0.01],
    [0, 600, 0],
    [15, 600, 0.03], // 0.025 -> demi vers le haut
    [1800, 550, 3.27],
    [8709120, 600, 14515.2],
  ])('%s XAF au taux %s donne %s USD', (xaf, rate, usd) => {
    expect(convertFromXaf(xaf, 'USD', rate)).toBe(usd);
  });

  it('suit le taux reçu (jamais de taux en dur)', () => {
    expect(convertFromXaf(1200, 'USD', 600)).toBe(2);
    expect(convertFromXaf(1200, 'USD', 400)).toBe(3);
  });

  it('refuse un montant qui n est pas un entier XAF', () => {
    expect(() => convertFromXaf(12.5, 'XAF', 600)).toThrow();
    expect(() => convertFromXaf(Number.NaN, 'USD', 600)).toThrow();
  });

  it.each([0, -600, Number.NaN])('refuse le taux %s pour une conversion en USD', (rate) => {
    expect(() => convertFromXaf(1800, 'USD', rate)).toThrow();
  });
});

describe('formatCatalogMoney', () => {
  const digits = (s: string) => s.replace(/\D/g, '');

  it('XAF : entier avec séparateurs de milliers et le code de la devise', () => {
    const fr = formatCatalogMoney(8709120, 'XAF', 'fr', 600);
    expect(digits(fr)).toBe('8709120');
    expect(fr).toContain('XAF');
    expect(digits(formatCatalogMoney(1365, 'XAF', 'en', 600))).toBe('1365');
  });

  it('XOF : même nombre que XAF, avec le code XOF', () => {
    const s = formatCatalogMoney(1365, 'XOF', 'fr', 600);
    expect(digits(s)).toBe('1365');
    expect(s).toContain('XOF');
  });

  it('USD : deux décimales, au taux donné', () => {
    expect(formatCatalogMoney(1800, 'USD', 'en', 600)).toBe('$3.00');
    expect(digits(formatCatalogMoney(1370, 'USD', 'fr', 600))).toBe('228');
    expect(formatCatalogMoney(1800, 'USD', 'en', 550)).toBe('$3.27');
  });
});
