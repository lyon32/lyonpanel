import { describe, expect, it } from 'vitest';
import { CURRENCIES, DEMO_RATES, formatMoney, parseCurrency } from '@/lib/currency';

const digits = (s: string) => s.replace(/\D/g, '');

describe('CURRENCIES', () => {
  it('contient XAF, XOF et USD', () => {
    expect([...CURRENCIES]).toEqual(['XAF', 'XOF', 'USD']);
  });
  it('a un taux de démonstration par devise, XAF valant 1', () => {
    expect(DEMO_RATES.XAF).toBe(1);
    for (const c of CURRENCIES) expect(DEMO_RATES[c]).toBeGreaterThan(0);
  });
});

describe('parseCurrency', () => {
  it.each(['XAF', 'XOF', 'USD'])('garde %s', (c) => {
    expect(parseCurrency(c)).toBe(c);
  });
  it.each([['EUR'], ['xaf'], [''], [undefined], [null], [42]])(
    'devise inconnue (%s) donne XAF',
    (v) => {
      expect(parseCurrency(v)).toBe('XAF');
    },
  );
});

describe('formatMoney', () => {
  it('XAF : entier sans décimales', () => {
    const fr = formatMoney(10000, 'XAF', 'fr');
    const en = formatMoney(10000, 'XAF', 'en');
    expect(digits(fr)).toBe('10000');
    expect(digits(en)).toBe('10000');
    expect(fr).not.toMatch(/[.,]\d{1,2}(\D|$)/);
    expect(fr).toContain('XAF');
  });
  it('XOF : entier sans décimales, converti avec le taux XOF', () => {
    const out = formatMoney(10000, 'XOF', 'fr');
    expect(digits(out)).toBe(String(Math.round(10000 * DEMO_RATES.XOF)));
    expect(out).toContain('XOF');
  });
  it('USD : 2 décimales, séparateur selon la langue', () => {
    const cents = Math.round(10000 * DEMO_RATES.USD * 100);
    expect(digits(formatMoney(10000, 'USD', 'en'))).toBe(String(cents));
    expect(formatMoney(10000, 'USD', 'en')).toMatch(/\.\d{2}\b/);
    expect(formatMoney(10000, 'USD', 'fr')).toMatch(/,\d{2}\b/);
  });
  it('zéro reste affiché', () => {
    expect(digits(formatMoney(0, 'XAF', 'fr'))).toBe('0');
  });
  it.each([[10.5], [0.1], [NaN], [Infinity]])('refuse le montant non entier %s', (n) => {
    expect(() => formatMoney(n, 'XAF', 'fr')).toThrow();
  });
});
