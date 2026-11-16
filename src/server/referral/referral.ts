import { z } from 'zod';

export interface Referral {
  code: string;
  link: string;
  referred_count: number;
  total_earned_xaf: number;
  pct: number;
}

// La page d inscription lit ?ref= et pré-remplit le champ code.
export function buildReferralLink(siteUrl: string, code: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/fr/inscription?ref=${encodeURIComponent(code)}`;
}

const pctSchema = z.coerce.number().min(0).max(100);

/**
 * Données de la page parrainage : uniquement des totaux, jamais d'information sur un filleul.
 * Lecture avec le client service, filtrée sur l'identifiant du parrain.
 */
export async function getReferral(userId: string): Promise<Referral> {
  // Import tardif : buildReferralLink reste testable sans le client service (server-only).
  const { createAdminClient } = await import('@/server/db/supabase-admin');
  const db = createAdminClient();
  const [profile, count, rewards, setting] = await Promise.all([
    db.from('profiles').select('referral_code').eq('id', userId).single(),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', userId),
    db.from('referral_rewards').select('amount_xaf').eq('referrer_id', userId),
    db.from('settings').select('value').eq('key', 'referral_pct').maybeSingle(),
  ]);
  if (profile.error) throw new Error(`profiles: ${profile.error.message}`);
  if (count.error) throw new Error(`profiles count: ${count.error.message}`);
  if (rewards.error) throw new Error(`referral_rewards: ${rewards.error.message}`);
  if (setting.error) throw new Error(`settings: ${setting.error.message}`);

  const pct = pctSchema.safeParse(setting.data?.value);
  const code = profile.data.referral_code;
  const { loadServerEnv } = await import('@/server/env');
  const siteUrl = loadServerEnv().NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    code,
    link: buildReferralLink(siteUrl, code),
    referred_count: count.count ?? 0,
    total_earned_xaf: rewards.data.reduce((sum, r) => sum + r.amount_xaf, 0),
    pct: pct.success ? pct.data : 5,
  };
}
