import 'server-only';
import type { z } from 'zod';
import type { listAuditQuerySchema } from '@/server/schemas/admin-audit';
import { createAdminClient } from '@/server/db/supabase-admin';

type Query = z.infer<typeof listAuditQuerySchema>;

/** Journal en lecture seule : du plus récent au plus ancien, curseur = id de la dernière ligne. */
export async function listAudit(query: Query) {
  let req = createAdminClient()
    .from('audit_log')
    .select('id, actor_id, action, target_table, target_id, details, created_at')
    .order('id', { ascending: false })
    .limit(query.limit + 1);
  if (query.action) req = req.eq('action', query.action);
  if (query.cursor) req = req.lt('id', Number(query.cursor));
  const { data, error } = await req;
  if (error) throw new Error('admin_audit_list_failed');
  const page = data.slice(0, query.limit);
  const last = page[page.length - 1];
  return { items: page, next_cursor: data.length > query.limit && last ? String(last.id) : null };
}
