import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError } from '@/server/http/api-error';

// Blocage progressif : 3 échecs par identifiant (30 par IP), puis pause de 15 min doublée à chaque échec, plafonnée à 24 h.
// Seuils : 3 par identifiant ; 30 par IP (plusieurs clients peuvent partager une IP : réseau mobile, bureau).
const IDENTIFIER_THRESHOLD = 3;
const IP_THRESHOLD = 30;
const BASE_PAUSE_SECONDS = 15 * 60;
const MAX_PAUSE_SECONDS = 24 * 60 * 60;
// Au-delà de 24 h sans échec, le niveau repart de zéro.
const MEMORY_SECONDS = 24 * 60 * 60;
// Adresse inconnue (aucun en-tête fiable) : on ne bloque pas « tout le monde » à la fois.
const UNKNOWN_IP = 'unknown';
// Valeur de repli pour les tests et le développement uniquement.
const DEV_FALLBACK_SECRET = 'lyonpanel-dev-only-hash-secret';

function hashSecret(): string {
  const secret = process.env.AUTH_HASH_SECRET;
  if (secret) return secret;
  // En production, un hash sans secret se retrouve par force brute : on refuse de démarrer l'opération.
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_HASH_SECRET manquant');
  return DEV_FALLBACK_SECRET;
}

// HMAC et non simple SHA-256 : sans le secret, impossible de retrouver un email ou une IP depuis la table.
const hmac = (value: string) => createHmac('sha256', hashSecret()).update(value).digest('hex');

/** Email ou téléphone : on ignore casse et espaces pour qu'on ne contourne pas le blocage. */
export const hashIdentifier = (identifier: string) => hmac(identifier.trim().toLowerCase());
export const hashIp = (ip: string) => hmac(`ip:${ip.trim()}`);

export type AttemptStore = {
  countFailures(q: {
    identifierHash: string;
    ipHash: string;
    since: Date;
    /** Tentative à ne pas compter (celle qu'on vient d'enregistrer). */
    excludeId?: number;
  }): Promise<{
    byIdentifier: number;
    byIp: number;
    lastIdentifierAt: Date | null;
    lastIpAt: Date | null;
  }>;
  record(a: { identifierHash: string; ipHash: string; success: boolean }): Promise<{ id: number }>;
  /** Requalifie une tentative enregistrée en succès. */
  markSuccess(id: number): Promise<void>;
  /** Supprime une tentative refusée : un refus ne doit pas rallonger la pause. */
  discard(id: number): Promise<void>;
};

/** Stockage dans la table login_attempts (client service : la table n'est pas lisible par les clients). */
export function createAttemptStore(db: SupabaseClient): AttemptStore {
  async function stats(
    column: 'identifier_hash' | 'ip_hash',
    value: string,
    since: Date,
    excludeId?: number,
  ) {
    let query = db
      .from('login_attempts')
      .select('created_at', { count: 'exact' })
      .eq(column, value)
      .eq('success', false)
      .gte('created_at', since.toISOString());
    if (excludeId !== undefined) query = query.neq('id', excludeId);
    const { data, count, error } = await query.order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(`login_attempts: ${error.message}`);
    const last = data?.[0]?.created_at as string | undefined;
    return { count: count ?? 0, last: last ? new Date(last) : null };
  }
  return {
    async countFailures({ identifierHash, ipHash, since, excludeId }) {
      const [byId, byIp] = await Promise.all([
        stats('identifier_hash', identifierHash, since, excludeId),
        stats('ip_hash', ipHash, since, excludeId),
      ]);
      return {
        byIdentifier: byId.count,
        byIp: byIp.count,
        lastIdentifierAt: byId.last,
        lastIpAt: byIp.last,
      };
    },
    async record({ identifierHash, ipHash, success }) {
      const { data, error } = await db
        .from('login_attempts')
        .insert({ identifier_hash: identifierHash, ip_hash: ipHash, success })
        .select('id')
        .single();
      if (error) throw new Error(`login_attempts: ${error.message}`);
      return { id: data.id as number };
    },
    async markSuccess(id) {
      const { error } = await db.from('login_attempts').update({ success: true }).eq('id', id);
      if (error) throw new Error(`login_attempts: ${error.message}`);
    },
    async discard(id) {
      const { error } = await db.from('login_attempts').delete().eq('id', id);
      if (error) throw new Error(`login_attempts: ${error.message}`);
    },
  };
}

/** Secondes restantes de la pause due après `prior` échecs, dont le dernier date de `lastAt`. */
function remainingPauseSeconds(
  prior: number,
  threshold: number,
  lastAt: Date | null,
  nowMs: number,
): number {
  if (prior < threshold || !lastAt) return 0;
  const pause = Math.min(BASE_PAUSE_SECONDS * 2 ** (prior - threshold), MAX_PAUSE_SECONDS);
  return Math.max(0, Math.ceil((lastAt.getTime() + pause * 1000 - nowMs) / 1000));
}

export function createLoginLimiter({ store }: { store: AttemptStore }) {
  return {
    /**
     * Enregistre la tentative comme échec AVANT de compter : une rafale parallèle se voit
     * elle-même, donc au plus 3 passent par identifiant. Les échecs précédents (24 h, cette tentative exclue)
     * fixent la pause, comptée depuis le dernier d'entre eux, pour l'identifiant OU l'IP.
     * Une tentative refusée est supprimée : insister ne rallonge pas la pause.
     */
    async begin(identifier: string, ip: string): Promise<{ succeed(): Promise<void> }> {
      const identifierHash = hashIdentifier(identifier);
      const ipHash = hashIp(ip);
      const { id } = await store.record({ identifierHash, ipHash, success: false });
      const since = new Date(Date.now() - MEMORY_SECONDS * 1000);
      const prior = await store.countFailures({ identifierHash, ipHash, since, excludeId: id });
      const now = Date.now();
      const byIdentifier = remainingPauseSeconds(
        prior.byIdentifier,
        IDENTIFIER_THRESHOLD,
        prior.lastIdentifierAt,
        now,
      );
      // Adresse inconnue : on ne bloque pas « tout le monde » à la fois.
      const byIp =
        ip.trim() === UNKNOWN_IP
          ? 0
          : remainingPauseSeconds(prior.byIp, IP_THRESHOLD, prior.lastIpAt, now);
      const retryAfter = Math.max(byIdentifier, byIp);
      if (retryAfter > 0) {
        await store.discard(id);
        apiError('AUTH_LOCKED', { retry_after_seconds: retryAfter });
      }
      // Un succès ne remet rien à zéro : il sort seulement cette tentative du compte des échecs.
      return { succeed: () => store.markSuccess(id) };
    },
  };
}
export type LoginLimiter = ReturnType<typeof createLoginLimiter>;

/** Plafond générique (inscription, mot de passe oublié) sur la même table que les connexions. */
export function createRateLimiter({ store }: { store: AttemptStore }) {
  return {
    async consume(o: {
      scope: string;
      key: string;
      max: number;
      windowSeconds: number;
    }): Promise<void> {
      // Le préfixe « scope: » sépare ce compteur de celui d'une connexion avec la même valeur.
      const hash = hmac(`rl:${o.scope}:${o.key.trim().toLowerCase()}`);
      await store.record({ identifierHash: hash, ipHash: hash, success: false });
      const since = new Date(Date.now() - o.windowSeconds * 1000);
      const { byIdentifier } = await store.countFailures({
        identifierHash: hash,
        ipHash: hash,
        since,
      });
      if (byIdentifier > o.max) apiError('RATE_LIMITED', { retry_after_seconds: o.windowSeconds });
    },
  };
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
