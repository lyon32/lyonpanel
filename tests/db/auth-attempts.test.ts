import { createHash, randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { afterAll, describe, expect, it } from 'vitest';

vi.mock('server-only', () => ({}));

import { adminClient } from './helpers/client';
import { createAttemptStore, createLoginLimiter } from '@/server/auth/rate-limit';

const db = adminClient();
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

// Valeurs uniques par exécution : la table n'est pas vidée entre deux tests.
const run = randomUUID();
const hashes: string[] = [];
const tag = (name: string) => {
  const h = sha(`${run}:${name}`);
  hashes.push(h);
  return h;
};

afterAll(async () => {
  await db.from('login_attempts').delete().in('identifier_hash', hashes);
  await db.from('login_attempts').delete().in('ip_hash', hashes);
});

describe('createAttemptStore (table login_attempts)', () => {
  it('enregistre un essai avec identifier_hash, ip_hash, success et created_at', async () => {
    const store = createAttemptStore(db);
    const identifierHash = tag('id1');
    const ipHash = tag('ip1');
    const { id } = await store.record({ identifierHash, ipHash, success: false });
    expect(id).toBeTruthy();
    const { data, error } = await db
      .from('login_attempts')
      .select('*')
      .eq('identifier_hash', identifierHash);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      identifier_hash: identifierHash,
      ip_hash: ipHash,
      success: false,
    });
    expect(data![0].created_at).toBeTruthy();
  });

  it('compte les échecs par identifiant et par IP depuis une date, sans les succès', async () => {
    const store = createAttemptStore(db);
    const identifierHash = tag('id2');
    const ipHash = tag('ip2');
    const otherIp = tag('ip2b');
    await store.record({ identifierHash, ipHash, success: false });
    await store.record({ identifierHash, ipHash: otherIp, success: false });
    await store.record({ identifierHash, ipHash, success: true });
    const since = new Date(Date.now() - 15 * 60_000);
    expect(await store.countFailures({ identifierHash, ipHash, since })).toMatchObject({
      byIdentifier: 2,
      byIp: 1,
    });
    expect(
      await store.countFailures({ identifierHash, ipHash, since: new Date(Date.now() + 60_000) }),
    ).toMatchObject({
      byIdentifier: 0,
      byIp: 0,
    });
  });

  it('markSuccess requalifie une tentative en succès : elle ne compte plus comme échec', async () => {
    const store = createAttemptStore(db);
    const identifierHash = tag('id3');
    const ipHash = tag('ip3');
    const { id } = await store.record({ identifierHash, ipHash, success: false });
    await store.markSuccess(id);
    const since = new Date(Date.now() - 15 * 60_000);
    expect(await store.countFailures({ identifierHash, ipHash, since })).toMatchObject({
      byIdentifier: 0,
      byIp: 0,
    });
  });

  it('countFailures renvoie la date du dernier échec et sait exclure une tentative', async () => {
    const store = createAttemptStore(db);
    const identifierHash = tag('id4');
    const ipHash = tag('ip4');
    await store.record({ identifierHash, ipHash, success: false });
    const { id } = await store.record({ identifierHash, ipHash, success: false });
    const since = new Date(Date.now() - 24 * 3600_000);
    const all = await store.countFailures({ identifierHash, ipHash, since });
    expect(all.byIdentifier).toBe(2);
    expect(all.lastIdentifierAt).toBeInstanceOf(Date);
    expect(all.lastIpAt).toBeInstanceOf(Date);
    const others = await store.countFailures({ identifierHash, ipHash, since, excludeId: id });
    expect(others.byIdentifier).toBe(1);
    const none = await store.countFailures({
      identifierHash: tag('id4-vide'),
      ipHash: tag('ip4-vide'),
      since,
    });
    expect(none).toEqual({
      byIdentifier: 0,
      byIp: 0,
      lastIdentifierAt: null,
      lastIpAt: null,
    });
  });

  it('discard supprime la tentative refusée', async () => {
    const store = createAttemptStore(db);
    const identifierHash = tag('id5');
    const ipHash = tag('ip5');
    const { id } = await store.record({ identifierHash, ipHash, success: false });
    await store.discard(id);
    const { data } = await db
      .from('login_attempts')
      .select('id')
      .eq('identifier_hash', identifierHash);
    expect(data).toHaveLength(0);
  });

  it('bloque pour de vrai en base après 3 échecs (pause de 15 min) (limiteur + table)', async () => {
    const limiter = createLoginLimiter({ store: createAttemptStore(db) });
    const identifier = `bloque-${run}@lyonpanel.test`;
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    hashes.push(sha(identifier), sha(ip)); // nettoyage (les hash réels dépendent de l'implémentation)
    for (let i = 0; i < 3; i++) await limiter.begin(identifier, ip);
    await expect(limiter.begin(identifier, ip)).rejects.toMatchObject({
      code: 'AUTH_LOCKED',
      details: { retry_after_seconds: expect.any(Number) },
    });
    // Nettoyage fiable : on supprime d'après les lignes réellement écrites.
    const { data } = await db
      .from('login_attempts')
      .select('id, identifier_hash, ip_hash')
      .order('id', { ascending: false })
      .limit(4);
    await db
      .from('login_attempts')
      .delete()
      .in(
        'id',
        (data ?? []).map((r) => r.id),
      );
  });

  it("ne stocke ni l'email ni l'IP en clair", async () => {
    const limiter = createLoginLimiter({ store: createAttemptStore(db) });
    const identifier = `clair-${run}@lyonpanel.test`;
    const ip = '198.51.100.250';
    await limiter.begin(identifier, ip);
    const { data } = await db
      .from('login_attempts')
      .select('*')
      .order('id', { ascending: false })
      .limit(1);
    const dump = JSON.stringify(data);
    expect(dump).not.toContain(identifier);
    expect(dump).not.toContain(ip);
    await db.from('login_attempts').delete().eq('id', data![0].id);
  });
});
