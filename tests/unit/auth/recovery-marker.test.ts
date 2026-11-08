import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({}) }));

import { hashIdentifier, hashIp } from '@/server/auth/rate-limit';
import {
  RECOVERY_MAX_AGE_SECONDS,
  signRecoveryMarker,
  verifyRecoveryMarker,
} from '@/server/auth/recovery-cookie';

/**
 * Contrat (src/server/auth/recovery-cookie.ts, fonctions pures, horloge injectable en millisecondes) :
 *   signRecoveryMarker(userId: string, now: number = Date.now()): string
 *     -> `${exp}.${signature}` ; exp = secondes epoch = floor(now / 1000) + 900 ;
 *        signature = HMAC-SHA256 hexadécimal (64 caractères) de `recovery-marker:${userId}:${exp}`,
 *        clé AUTH_HASH_SECRET (même secret que les hash de connexion, domaine distinct).
 *   verifyRecoveryMarker(value: string, userId: string, now: number = Date.now()): boolean
 *     -> true seulement si : forme `exp.signature` valide, exp pas dépassé (now/1000 < exp),
 *        signature exacte pour ce userId et cet exp. Comparaison avec timingSafeEqual
 *        (longueurs égales vérifiées avant, jamais d'exception : toute valeur mal formée donne false).
 */

const T0 = Date.UTC(2026, 10, 8, 10, 0, 0); // 2026-11-08T10:00:00Z
const USER = '3f1c2b4a-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.stubEnv('AUTH_HASH_SECRET', 'secret-de-test-recovery');
});
afterEach(() => vi.unstubAllEnvs());

describe('signRecoveryMarker', () => {
  it('produit exp.signature avec exp = maintenant + 15 minutes (en secondes)', () => {
    const marker = signRecoveryMarker(USER, T0);
    const [exp, sig, ...rest] = marker.split('.');
    expect(rest).toHaveLength(0);
    expect(Number(exp)).toBe(T0 / 1000 + RECOVERY_MAX_AGE_SECONDS);
    expect(RECOVERY_MAX_AGE_SECONDS).toBe(900);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne contient pas l'identifiant de l'utilisateur en clair", () => {
    expect(signRecoveryMarker(USER, T0)).not.toContain(USER);
  });

  it("est stable pour les mêmes entrées et change avec l'utilisateur, l'instant ou le secret", () => {
    const a = signRecoveryMarker(USER, T0);
    expect(signRecoveryMarker(USER, T0)).toBe(a);
    expect(signRecoveryMarker('autre-user', T0)).not.toBe(a);
    expect(signRecoveryMarker(USER, T0 + 5_000)).not.toBe(a);
    vi.stubEnv('AUTH_HASH_SECRET', 'autre-secret');
    expect(signRecoveryMarker(USER, T0)).not.toBe(a);
  });

  it("domaine distinct des hash de connexion : la signature n'égale aucun hash d'identifiant ou d'IP", () => {
    const marker = signRecoveryMarker(USER, T0);
    const [exp, sig] = marker.split('.') as [string, string];
    for (const login of [
      hashIdentifier(USER),
      hashIdentifier(`${USER}:${exp}`),
      hashIdentifier(`recovery-session:${USER}`),
      hashIp(USER),
    ])
      expect(sig).not.toBe(login);
    // et un hash de connexion ne peut pas servir de marqueur
    expect(verifyRecoveryMarker(`${exp}.${hashIdentifier(`${USER}:${exp}`)}`, USER, T0)).toBe(
      false,
    );
  });
});

describe('verifyRecoveryMarker', () => {
  it('accepte un marqueur valide, pour le bon utilisateur', () => {
    expect(verifyRecoveryMarker(signRecoveryMarker(USER, T0), USER, T0 + 60_000)).toBe(true);
  });

  it("accepte jusqu'à la dernière seconde, refuse à l'expiration (15 min)", () => {
    const marker = signRecoveryMarker(USER, T0);
    expect(verifyRecoveryMarker(marker, USER, T0 + 899_000)).toBe(true);
    expect(verifyRecoveryMarker(marker, USER, T0 + 900_000)).toBe(false);
    expect(verifyRecoveryMarker(marker, USER, T0 + 3600_000)).toBe(false);
  });

  it("refuse un marqueur expiré même si le cookie est rejoué avec une durée d'attribut prolongée", () => {
    // Le navigateur (ou un pirate) peut renvoyer le même cookie sans changer sa valeur : la valeur seule décide.
    const old = signRecoveryMarker(USER, T0);
    expect(verifyRecoveryMarker(old, USER, T0 + 2 * 3600_000)).toBe(false);
  });

  it('refuse un marqueur signé pour un autre utilisateur', () => {
    const marker = signRecoveryMarker('autre-user', T0);
    expect(verifyRecoveryMarker(marker, USER, T0)).toBe(false);
  });

  it("refuse une expiration modifiée (prolongée) avec la signature d'origine", () => {
    const [exp, sig] = signRecoveryMarker(USER, T0).split('.') as [string, string];
    const extended = `${Number(exp) + 86_400}.${sig}`;
    expect(verifyRecoveryMarker(extended, USER, T0 + 1000_000)).toBe(false);
  });

  it('refuse une signature altérée (un seul caractère)', () => {
    const [exp, sig] = signRecoveryMarker(USER, T0).split('.') as [string, string];
    const flipped = `${sig.startsWith('a') ? 'b' : 'a'}${sig.slice(1)}`;
    expect(verifyRecoveryMarker(`${exp}.${flipped}`, USER, T0)).toBe(false);
  });

  it('refuse un marqueur signé avec un autre secret', () => {
    const marker = signRecoveryMarker(USER, T0);
    vi.stubEnv('AUTH_HASH_SECRET', 'secret-change');
    expect(verifyRecoveryMarker(marker, USER, T0)).toBe(false);
  });

  it('valeurs mal formées : false, sans lever (y compris signature de longueur différente)', () => {
    const [exp, sig] = signRecoveryMarker(USER, T0).split('.') as [string, string];
    const bads = [
      '',
      'abc',
      '.',
      `${exp}.`,
      `.${sig}`,
      `${exp}.${sig.slice(0, 10)}`,
      `${exp}.${sig}00`,
      `${exp}.${sig}.extra`,
      `pasunnombre.${sig}`,
      `-1.${sig}`,
      `1e3.${sig}`,
      'x'.repeat(5000),
    ];
    for (const bad of bads) {
      expect(() => verifyRecoveryMarker(bad, USER, T0)).not.toThrow();
      expect(verifyRecoveryMarker(bad, USER, T0)).toBe(false);
    }
  });

  it('utilise une comparaison en temps constant (timingSafeEqual) et le domaine recovery-marker:', () => {
    const src = readFileSync(
      join(process.cwd(), 'src', 'server', 'auth', 'recovery-cookie.ts'),
      'utf8',
    );
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/recovery-marker:/);
  });
});
