import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAttemptStore, hashIdentifier, type AttemptStore } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { notifyOwner } from '@/server/providers/telegram';

// Deux appareils : le téléphone et un gestionnaire de mots de passe (secours si l'un est perdu).
export const REQUIRED_DEVICES = 2;
// Une alerte Telegram tous les 5 mauvais codes (fenêtre de 15 min).
const ALERT_EVERY = 5;
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

/** Enregistre un échec sous une clé fixe, puis alerte le propriétaire à chaque multiple de 5 (fenêtre de 15 min). */
export async function recordFailureAndAlert(store: AttemptStore, hash: string): Promise<void> {
  await store.record({ identifierHash: hash, ipHash: hash, success: false });
  await alertIfThreshold(store, hash);
}

/** Alerte si le nombre d'échecs de la fenêtre est un multiple de 5. Ni mot de passe, ni email, ni IP dans l'alerte. */
export async function alertIfThreshold(store: AttemptStore, hash: string): Promise<void> {
  const { byIdentifier } = await store.countFailures({
    identifierHash: hash,
    ipHash: hash,
    since: new Date(Date.now() - FAILURE_WINDOW_MS),
  });
  if (byIdentifier > 0 && byIdentifier % ALERT_EVERY === 0) {
    await notifyOwner('admin_login_failed', { failures: byIdentifier });
  }
}

/** Compte l'échec du code à 6 chiffres (par administrateur : le code est lié au compte). */
async function recordCodeFailure(userId: string): Promise<void> {
  await recordFailureAndAlert(
    createAttemptStore(createAdminClient()),
    hashIdentifier(`admin-mfa:${userId}`),
  );
}

/** Essaie le code sur chaque appareil vérifié (téléphone, puis secours). Mauvais code : 401 MFA_REQUIRED. */
export async function verifyAdminCode(
  supabase: SupabaseClient,
  userId: string,
  code: string,
): Promise<void> {
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
    if (!result.error) return;
  }
  await recordCodeFailure(userId);
  apiError('MFA_REQUIRED');
}

/** Démarre l'enrôlement d'un appareil : renvoie le QR et la clé à recopier. Refusé au-delà de 2 appareils. */
export async function enrollDevice(supabase: SupabaseClient) {
  const factors = await listFactors(supabase);
  if (!mfaSetupStatus(factors).canEnrollMore) {
    apiError('VALIDATION_ERROR', { fields: { _: 'MFA_DEVICES_COMPLETE' } });
  }
  // Un QR abandonné bloquerait un nouvel essai : on retire les appareils jamais confirmés.
  for (const f of factors.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `lyonpanel-${Date.now()}`,
  });
  if (error) throw new Error(`mfa.enroll: ${error.message}`);
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirme l'appareil avec un premier code ; un mauvais code est compté comme un échec. */
export async function confirmDevice(
  supabase: SupabaseClient,
  userId: string,
  factorId: string,
  code: string,
): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) apiError('MFA_REQUIRED');
  const result = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (result.error) {
    await recordCodeFailure(userId);
    apiError('MFA_REQUIRED');
  }
}
