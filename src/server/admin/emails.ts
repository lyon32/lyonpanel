import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';

/** Adresses des clients par identifiant, pour les listes admin (une seule requête). */
export async function emailsByUserId(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select('id, email')
    .in('id', unique);
  if (error) throw new Error('admin_emails_failed');
  const map = new Map<string, string>();
  for (const p of data) if (p.email) map.set(p.id, p.email);
  return map;
}
