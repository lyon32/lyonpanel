import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { memoryStore } from '../../helpers/memory-attempt-store';
import {
  createLoginLimiter,
  createRateLimiter,
  hashIdentifier,
  hashIp,
  type AttemptStore,
} from '@/server/auth/rate-limit';

/**
 * Contrat attendu (blocage progressif, pré-enregistrement atomique) :
 *   limiter.begin(identifier, ip): Promise<{ succeed(): Promise<void> }>
 *     1. store.record(échec)  2. store.countFailures({ ..., since: maintenant - 24 h, excludeId: id })
 *     3. prior = échecs précédents sur 24 h (cette tentative exclue), par identifiant (seuil 3) et par IP (seuil 30, IP partagées).
 *        seuil = 3 (identifiant) ou 30 (IP). prior < seuil : passe. prior >= seuil : pause = min(15 min x 2^(prior - seuil), 24 h) depuis le DERNIER échec précédent
 *        (3 -> 15 min, 4 -> 30 min, 5 -> 1 h, 6 -> 2 h ... plafond 24 h).
 *        Si maintenant < dernier échec + pause : store.discard(id) (un refus ne compte pas) puis AUTH_LOCKED,
 *        details.retry_after_seconds = secondes restantes (arrondi au-dessus), le plus grand délai entre
 *        identifiant et IP ('unknown' : l'IP est ignorée).
 *     succeed() requalifie la tentative en succès (store.markSuccess).
 *   AttemptStore : record -> { id } ; markSuccess(id) ; discard(id) ;
 *     countFailures({ identifierHash, ipHash, since, excludeId? }) ->
 *       { byIdentifier, byIp, lastIdentifierAt: Date | null, lastIpAt: Date | null }.
 *   createRateLimiter({ store }).consume({ scope, key, max, windowSeconds }) : inchangé.
 */

const MIN = 60_000;

beforeEach(() => {
  // Seule la date est simulée : le faux stockage utilise de vrais setTimeout pour entrelacer les appels.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
  vi.stubEnv('AUTH_HASH_SECRET', 'secret-de-test-a');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

type Limiter = ReturnType<typeof createLoginLimiter>;
async function fail(limiter: Limiter, id: string, ip: string, n = 1) {
  for (let i = 0; i < n; i++) await limiter.begin(id, ip);
}
function setNow(offsetMs: number) {
  vi.setSystemTime(new Date('2026-11-08T10:00:00Z').getTime() + offsetMs);
}

describe('hashIdentifier / hashIp', () => {
  it('donne 64 caractères hexadécimaux qui ne contiennent pas la valeur en clair', () => {
    const h = hashIdentifier('jean@lyonpanel.test');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('jean');
    expect(hashIp('203.0.113.7')).toMatch(/^[0-9a-f]{64}$/);
  });
  it("ignore la casse et les espaces d'un email", () => {
    expect(hashIdentifier(' Jean@LyonPanel.test ')).toBe(hashIdentifier('jean@lyonpanel.test'));
  });
  it('donne des hash différents pour des identifiants différents', () => {
    expect(hashIdentifier('a@b.co')).not.toBe(hashIdentifier('c@d.co'));
  });
  it('est un HMAC : change avec AUTH_HASH_SECRET et ne vaut pas un simple SHA-256', async () => {
    const { createHash } = await import('node:crypto');
    const a = hashIdentifier('a@b.co');
    expect(a).not.toBe(createHash('sha256').update('a@b.co').digest('hex'));
    vi.stubEnv('AUTH_HASH_SECRET', 'secret-de-test-b');
    expect(hashIdentifier('a@b.co')).not.toBe(a);
  });
  it('en production sans AUTH_HASH_SECRET : lève une erreur (pas de repli)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_HASH_SECRET', '');
    expect(() => hashIdentifier('a@b.co')).toThrow();
    expect(() => hashIp('1.1.1.1')).toThrow();
  });
  it('hors production sans AUTH_HASH_SECRET : valeur de repli de test, stable', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_HASH_SECRET', '');
    expect(hashIdentifier('a@b.co')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIdentifier('a@b.co')).toBe(hashIdentifier('a@b.co'));
  });
});

describe('createLoginLimiter.begin (blocage progressif)', () => {
  const lockedWith = (seconds: number) =>
    expect.objectContaining({
      code: 'AUTH_LOCKED',
      status: 429,
      details: { retry_after_seconds: seconds },
    });

  /** Pose n échecs récents directement dans le stockage (sans attendre les pauses). */
  async function seed(store: AttemptStore, id: string, ip: string, n: number) {
    for (let i = 0; i < n; i++)
      await store.record({
        identifierHash: hashIdentifier(id),
        ipHash: hashIp(ip),
        success: false,
      });
  }

  it('laisse passer 3 tentatives, bloque la 4e pour exactement 15 minutes (900 s)', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(900));
  });

  it('retry_after_seconds est le temps restant : 800 s après 100 s, arrondi au-dessus', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    setNow(100_000);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(800));
    setNow(100_400);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(800));
  });

  it('débloque à la fin de la pause, pas avant', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    setNow(14 * MIN + 59_000);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(1));
    setNow(15 * MIN + 1_000);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).resolves.toBeDefined();
  });

  it('un refus ne compte pas : insister pendant la pause ne la rallonge pas', async () => {
    const { store, rows } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    for (let i = 0; i < 10; i++)
      await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toBeDefined();
    expect(rows).toHaveLength(3);
    setNow(15 * MIN + 1_000);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).resolves.toBeDefined();
  });

  it('chaque nouvel échec après une pause double la suivante : 30 min, 1 h, 2 h', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    let t = 0;
    for (const seconds of [1800, 3600, 7200]) {
      t += (seconds / 2) * 1000 + 1000; // fin de la pause précédente
      setNow(t);
      await limiter.begin('a@b.co', '1.1.1.1'); // l'essai passe, puis échoue
      await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(seconds));
    }
  });

  it('plafonne la pause à 24 h (86 400 s)', async () => {
    const { store } = memoryStore();
    await seed(store, 'a@b.co', '1.1.1.1', 12);
    await expect(createLoginLimiter({ store }).begin('a@b.co', '1.1.1.1')).rejects.toEqual(
      lockedWith(86_400),
    );
  });

  it('avec 9 échecs récents la pause est de 16 h (57 600 s)', async () => {
    const { store } = memoryStore();
    await seed(store, 'a@b.co', '1.1.1.1', 9);
    await expect(createLoginLimiter({ store }).begin('a@b.co', '1.1.1.1')).rejects.toEqual(
      lockedWith(57_600),
    );
  });

  it('oublie les échecs de plus de 24 h : le niveau repart de zéro', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    setNow(25 * 60 * MIN);
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(900));
  });

  it('bloque un identifiant attaqué depuis 3 IP différentes', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    for (let i = 1; i <= 3; i++) await fail(limiter, 'victime@b.co', `10.0.0.${i}`);
    await expect(limiter.begin('victime@b.co', '10.0.0.99')).rejects.toEqual(lockedWith(900));
  });

  it("l'IP n'est bloquée qu'à 30 échecs sur 24 h (IP partagées) : 29 identifiants différents passent", async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    for (let i = 1; i <= 30; i++) await limiter.begin(`cible-${i}@b.co`, '9.9.9.9');
    await expect(limiter.begin('autre@b.co', '9.9.9.9')).rejects.toEqual(lockedWith(900));
  });

  it('40 tentatives sur 40 identifiants différents depuis une IP : bloquées dès la 31e', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    let passed = 0;
    let locked = 0;
    for (let i = 1; i <= 40; i++) {
      try {
        await limiter.begin(`cible-${i}@b.co`, '9.9.9.9');
        passed++;
      } catch (e) {
        expect((e as { code: string }).code).toBe('AUTH_LOCKED');
        locked++;
      }
    }
    expect(passed).toBe(30);
    expect(locked).toBe(10);
  });

  it('la pause par IP double aussi : 30 -> 15 min, 31 -> 30 min, 36 -> 16 h, 40 -> 24 h', async () => {
    for (const [prior, seconds] of [
      [30, 900],
      [31, 1800],
      [36, 57_600],
      [40, 86_400],
    ] as const) {
      const { store } = memoryStore();
      for (let i = 0; i < prior; i++)
        await store.record({
          identifierHash: hashIdentifier(`autre-${i}@b.co`),
          ipHash: hashIp('8.8.8.8'),
          success: false,
        });
      await expect(createLoginLimiter({ store }).begin('neuf@b.co', '8.8.8.8')).rejects.toEqual(
        lockedWith(seconds),
      );
    }
  });

  it('29 échecs sur une IP ne bloquent personne', async () => {
    const { store } = memoryStore();
    for (let i = 0; i < 29; i++)
      await store.record({
        identifierHash: hashIdentifier(`autre-${i}@b.co`),
        ipHash: hashIp('8.8.8.8'),
        success: false,
      });
    await expect(
      createLoginLimiter({ store }).begin('neuf@b.co', '8.8.8.8'),
    ).resolves.toBeDefined();
  });

  it('prend le plus long des deux délais (identifiant et IP)', async () => {
    const { store } = memoryStore();
    // IP à 31 échecs (30 min) ; l'identifiant, lui, n'a que 3 échecs venant d'autres IP (15 min)
    for (let i = 0; i < 31; i++)
      await store.record({
        identifierHash: hashIdentifier(`autre-${i}@b.co`),
        ipHash: hashIp('1.1.1.1'),
        success: false,
      });
    await seed(store, 'a@b.co', '2.2.2.2', 3);
    const limiter = createLoginLimiter({ store });
    await expect(limiter.begin('a@b.co', '1.1.1.1')).rejects.toEqual(lockedWith(1800));
    await expect(limiter.begin('a@b.co', '3.3.3.3')).rejects.toEqual(lockedWith(900));
  });

  it('ne bloque pas un autre identifiant sur une autre IP', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'a@b.co', '1.1.1.1', 3);
    await expect(limiter.begin('autre@b.co', '2.2.2.2')).resolves.toBeDefined();
  });

  it('enregistre la tentative AVANT de rendre la main (échec en attente)', async () => {
    const { store, rows } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await limiter.begin('a@b.co', '1.1.1.1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.success).toBe(false);
  });

  it('succeed() requalifie la tentative en succès : elle ne compte plus comme échec', async () => {
    const { store, rows } = memoryStore();
    const limiter = createLoginLimiter({ store });
    for (let i = 0; i < 10; i++) {
      const attempt = await limiter.begin('a@b.co', '1.1.1.1');
      await attempt.succeed();
    }
    expect(rows.every((r) => r.success)).toBe(true);
    await expect(limiter.begin('a@b.co', '1.1.1.1')).resolves.toBeDefined();
  });

  it('un succès ne remet pas les autres compteurs à zéro (pas de reset depuis son propre compte)', async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await fail(limiter, 'victime@b.co', '6.6.6.6', 2);
    const own = await limiter.begin('mon-compte@b.co', '6.6.6.6');
    await own.succeed(); // le pirate se connecte à son propre compte
    await limiter.begin('victime@b.co', '6.6.6.6'); // 3e échec
    await expect(limiter.begin('victime@b.co', '6.6.6.6')).rejects.toEqual(lockedWith(900));
  });

  it('enregistre uniquement des hash : ni identifiant ni IP en clair', async () => {
    const { store, rows } = memoryStore();
    const limiter = createLoginLimiter({ store });
    await limiter.begin('+237600000001', '203.0.113.7');
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain('237600000001');
    expect(dump).not.toContain('203.0.113.7');
    expect(rows[0]?.identifierHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("IP 'unknown' : seul le plafond par identifiant s'applique (personne d'autre n'est bloqué)", async () => {
    const { store } = memoryStore();
    const limiter = createLoginLimiter({ store });
    for (let i = 1; i <= 8; i++) await fail(limiter, `cible-${i}@b.co`, 'unknown');
    await expect(limiter.begin('autre@b.co', 'unknown')).resolves.toBeDefined();
    await fail(limiter, 'meme@b.co', 'unknown', 3);
    await expect(limiter.begin('meme@b.co', 'unknown')).rejects.toEqual(lockedWith(900));
  });

  it('rafale de 20 requêtes parallèles : au plus 3 passent, les refus ne laissent aucune trace', async () => {
    const { store, rows } = memoryStore();
    const limiter = createLoginLimiter({ store });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => limiter.begin('cible@b.co', '5.5.5.5')),
    );
    const passed = results.filter((r) => r.status === 'fulfilled').length;
    const locked = results.filter(
      (r) => r.status === 'rejected' && (r.reason as { code?: string }).code === 'AUTH_LOCKED',
    ).length;
    expect(passed).toBeLessThanOrEqual(3);
    expect(passed + locked).toBe(20);
    expect(rows).toHaveLength(passed);
  });
});

describe('createRateLimiter.consume', () => {
  const opts = { scope: 'register', key: '1.1.1.1', max: 10, windowSeconds: 3600 };

  it('accepte max appels puis refuse le suivant avec RATE_LIMITED 429 et un délai', async () => {
    const { store } = memoryStore();
    const rl = createRateLimiter({ store });
    for (let i = 0; i < 10; i++) await rl.consume(opts);
    const err = await rl.consume(opts).catch((e) => e);
    expect(err).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(err.details.retry_after_seconds).toBeGreaterThan(0);
    expect(err.details.retry_after_seconds).toBeLessThanOrEqual(3600);
  });

  it('chaque scope et chaque clé ont leur propre compteur', async () => {
    const { store } = memoryStore();
    const rl = createRateLimiter({ store });
    for (let i = 0; i < 10; i++) await rl.consume(opts);
    await expect(rl.consume({ ...opts, key: '2.2.2.2' })).resolves.toBeUndefined();
    await expect(rl.consume({ ...opts, scope: 'forgot-ip' })).resolves.toBeUndefined();
  });

  it('libère après la fenêtre, pas avant', async () => {
    const { store } = memoryStore();
    const rl = createRateLimiter({ store });
    for (let i = 0; i < 10; i++) await rl.consume(opts);
    setNow(59 * MIN);
    await expect(rl.consume(opts)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    setNow(125 * MIN); // la tentative refusée à 59 min compte aussi : fenêtre complète ensuite
    await expect(rl.consume(opts)).resolves.toBeUndefined();
  });

  it("stocke un identifiant préfixé et hashé (jamais l'email en clair)", async () => {
    const { store, rows } = memoryStore();
    const rl = createRateLimiter({ store });
    await rl.consume({
      scope: 'forgot-email',
      key: 'jean@lyonpanel.test',
      max: 5,
      windowSeconds: 3600,
    });
    expect(JSON.stringify(rows)).not.toContain('jean');
    expect(rows[0]?.identifierHash).toMatch(/^[0-9a-f]{64}$/);
    // le préfixe sépare ce compteur de celui d'une connexion avec le même email
    expect(rows[0]?.identifierHash).not.toBe(hashIdentifier('jean@lyonpanel.test'));
  });

  it('appels parallèles : pas plus de max acceptés', async () => {
    const { store } = memoryStore();
    const rl = createRateLimiter({ store });
    const res = await Promise.allSettled(
      Array.from({ length: 20 }, () => rl.consume({ ...opts, max: 5 })),
    );
    expect(res.filter((r) => r.status === 'fulfilled').length).toBeLessThanOrEqual(5);
  });
});
