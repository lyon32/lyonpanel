import { describe, expect, it } from 'vitest';
import { formatBytes, formatXaf, parseRange } from '@/lib/admin-format';

describe('parseRange', () => {
  it('accepte les trois périodes', () => {
    expect(parseRange('7d')).toBe('7d');
    expect(parseRange('30d')).toBe('30d');
    expect(parseRange('today')).toBe('today');
  });
  it('retombe sur aujourd’hui pour une valeur inconnue ou absente', () => {
    expect(parseRange(undefined)).toBe('today');
    expect(parseRange('90d')).toBe('today');
    expect(parseRange(['30d', '7d'])).toBe('30d');
  });
});

describe('formatXaf', () => {
  it('affiche un entier avec le suffixe XAF', () => {
    expect(formatXaf(0, 'fr').replace(/\s/g, ' ')).toBe('0 XAF');
    expect(formatXaf(12500, 'en')).toBe('12,500 XAF');
  });
  it('garde le signe d’un solde négatif', () => {
    expect(formatXaf(-300, 'en')).toBe('-300 XAF');
  });
});

describe('formatBytes', () => {
  it('choisit l’unité', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(2048)).toBe('2.0 Ko');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 Mo');
  });
});
