import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ERROR_STATUS, getErrorMessage } from '@/server/http/api-error';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const FR = JSON.parse(read('src/messages/errors.fr.json')) as Record<string, string>;
const EN = JSON.parse(read('src/messages/errors.en.json')) as Record<string, string>;

/* Nouveau code ALREADY_CANCELLED (409, API_SPEC §3) : bonus de parrainage déjà annulé par l'administrateur. */
describe('code d’erreur ALREADY_CANCELLED', () => {
  it('existe dans la table des erreurs avec le statut 409', () => {
    expect((ERROR_STATUS as Record<string, number>).ALREADY_CANCELLED).toBe(409);
  });

  it('a un message en français et en anglais, différents l’un de l’autre', () => {
    expect(FR.ALREADY_CANCELLED).toBeTruthy();
    expect(EN.ALREADY_CANCELLED).toBeTruthy();
    expect(FR.ALREADY_CANCELLED).not.toBe(EN.ALREADY_CANCELLED);
    expect(getErrorMessage('ALREADY_CANCELLED' as never, 'fr')).toBe(FR.ALREADY_CANCELLED);
    expect(getErrorMessage('ALREADY_CANCELLED' as never, 'en')).toBe(EN.ALREADY_CANCELLED);
  });

  it('est décrit dans API_SPEC §3 avec le statut 409', () => {
    expect(read('API_SPEC.md')).toMatch(/\|\s*ALREADY_CANCELLED\s*\|\s*409\s*\|/);
  });

  it('chaque code d’API_SPEC §3 a un message FR et EN (couverture complète)', () => {
    const codes = [
      ...read('API_SPEC.md').matchAll(/^\|\s*([A-Z][A-Z_]+)\s*\|\s*(\d{3})\s*\|/gm),
    ].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThan(20);
    const missing = codes.filter((c) => !FR[c] || !EN[c]);
    expect(missing).toEqual([]);
  });
});
