import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAttemptStore, hashIdentifier, type AttemptStore } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { notifyOwner } from '@/server/providers/telegram';

// Deux appareils : le téléphone et un gestionnaire de mots de passe (secours si l'un est perdu).
export const REQUIRED_DEVICES = 2;
// Au 5e échec de la fenêtre (15 min) : une alerte Telegram et le verrou. Pas de 2e alerte dans la même fenêtre.
const ALERT_AT = 5;
const LOCK_AFTER = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;

type Factor = { id: string; factor_type: string; status: string };

const isVerifiedTotp = (f: Factor) => f.factor_type === 'totp' && f.status === 'verified';

/** Seuls les appareils TOTP vérifiés comptent : un QR scanné sans code ne protège rien. */
export function mfaSetupStatus(factors: Factor[]): {
  verified: number;
  needsMoreDevices: boolean;
  canEnrollMore: boolean;
} {
  const verified = factors.filter(isVerifiedTotp).length;
  return {
    verified,
    needsMoreDevices: verified < REQUIRED_DEVICES,
    canEnrollMore: verified < REQUIRED_DEVICES,
  };
}

async function listFactors(supabase: SupabaseClient): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(`mfa.listFactors: ${error.message}`);
  return (data.all ?? []) as Factor[];
}

export async function getMfaStatus(supabase: SupabaseClient) {
  return mfaSetupStatus(await listFactors(supabase));
}

/** Enregistre un échec sous une clé fixe, puis alerte le propriétaire au 5e échec de la fenêtre (15 min). */
export async function recordFailureAndAlert(store: AttemptStore, hash: string): Promise<void> {
  await store.record({ identifierHash: hash, ipHash: hash, success: false });
  await alertIfThreshold(store, hash);
}

/** Alerte quand le nombre d'échecs de la fenêtre vaut exactement 5. Ni mot de passe, ni email, ni IP dans l'alerte. */
export async function alertIfThreshold(store: AttemptStore, hash: string): Promise<void> {
  const { byIdentifier } = await store.countFailures({
    identifierHash: hash,
    ipHash: hash,
    since: new Date(Date.now() - FAILURE_WINDOW_MS),
  });
  if (byIdentifier === ALERT_AT) {
    await notifyOwner('admin_login_failed', { failures: byIdentifier });
  }
}

const lockHash = (userId: string) => hashIdentifier(`admin-mfa:${userId}`);
// Marqueur « dernier succès » : les échecs d'avant ce moment ne comptent plus (remise à zéro).
const resetHash = (userId: string) => hashIdentifier(`admin-mfa-ok:${userId}`);

/**
 * Verrou du code à 6 chiffres, par administrateur. L'essai est enregistré AVANT d'appeler Supabase
 * (une rafale parallèle se voit elle-même) ; au-delà de 5 échecs en 15 min : 429 sans rien contacter.
 */
async function beginCodeAttempt(userId: string) {
  const store = createAttemptStore(createAdminClient());
  const hash = lockHash(userId);
  const windowStart = new Date(Date.now() - FAILURE_WINDOW_MS);
  const { id } = await store.record({ identifierHash: hash, ipHash: hash, success: false });
  const marker = resetHash(userId);
  const { lastIdentifierAt } = await store.countFailures({
    identifierHash: marker,
    ipHash: marker,
    since: windowStart,
  });
  const since = lastIdentifierAt ?? windowStart;
  const prior = await store.countFailures({
    identifierHash: hash,
    ipHash: hash,
    since,
    excludeId: id,
  });
  if (prior.byIdentifier >= LOCK_AFTER) {
    // Un essai refusé ne compte pas : insister ne prolonge pas le verrou et ne déclenche pas d'alerte.
    await store.discard(id);
    apiError('RATE_LIMITED', { retry_after_seconds: FAILURE_WINDOW_MS / 1000 });
  }
  return {
    async succeed() {
      await store.markSuccess(id);
      await store.record({ identifierHash: marker, ipHash: marker, success: false });
    },
    async fail() {
      await alertIfThreshold(store, hash);
    },
  };
}

/** Essaie le code sur chaque appareil vérifié (téléphone, puis secours). Mauvais code : 401 MFA_REQUIRED. */
export async function verifyAdminCode(
  supabase: SupabaseClient,
  userId: string,
  code: string,
): Promise<void> {
  const attempt = await beginCodeAttempt(userId);
  const devices = (await listFactors(supabase)).filter(isVerifiedTotp);
  if (devices.length === 0) apiError('NOT_FOUND');
  for (const device of devices) {
    const challenge = await supabase.auth.mfa.challenge({ factorId: device.id });
    if (challenge.error) continue;
    const result = await supabase.auth.mfa.verify({
      factorId: device.id,
      challengeId: challenge.data.id,
      code,
    });
    if (!result.error) {
      await attempt.succeed();
      return;
    }
  }
  await attempt.fail();
  apiError('MFA_REQUIRED');
}

/** Démarre l'enrôlement d'un appareil : renvoie le QR et la clé à recopier. Refusé au-delà de 2 appareils. */
export async function enrollDevice(supabase: SupabaseClient) {
  const factors = await listFactors(supabase);
  if (!mfaSetupStatus(factors).canEnrollMore) {
    apiError('VALIDATION_ERROR', { fields: { _: 'MFA_DEVICES_COMPLETE' } });
  }
  // ADMIN_ENROLL_OPEN=false : enrôlement fermé (404), même avec moins de 2 appareils.
  if (process.env.ADMIN_ENROLL_OPEN === 'false') apiError('NOT_FOUND');
  // Un QR abandonné bloquerait un nouvel essai : on retire les appareils jamais confirmés.
  for (const f of factors.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (unenrollError) throw new Error(`mfa.unenroll: ${unenrollError.message}`);
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `lyonpanel-${Date.now()}`,
  });
  if (error) {
    // 1 appareil vérifié et session aal1 : Supabase exige le code d'abord, ce n'est pas une panne.
    if (error.code === 'insufficient_aal' || /AAL2 required/i.test(error.message)) {
      apiError('MFA_REQUIRED');
    }
    throw new Error(`mfa.enroll: ${error.message}`);
  }
  // Supabase termine le SVG par un retour à la ligne : next/image refuse une source qui finit par un espace.
  return { factorId: data.id, qrCode: data.totp.qr_code.trimEnd(), secret: data.totp.secret };
}

/** Confirme l'appareil avec un premier code ; un mauvais code est compté comme un échec (même verrou). */
export async function confirmDevice(
  supabase: SupabaseClient,
  userId: string,
  factorId: string,
  code: string,
): Promise<void> {
  const attempt = await beginCodeAttempt(userId);
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) apiError('MFA_REQUIRED');
  const result = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (result.error) {
    await attempt.fail();
    apiError('MFA_REQUIRED');
  }
  await attempt.succeed();
}
