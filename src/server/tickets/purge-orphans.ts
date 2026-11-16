import 'server-only';
import { ATTACHMENT_BUCKET } from './attachments';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { ATTACHMENT_PATH, purgeOrphansSchema } from '@/server/schemas/storage';

// Un envoi en cours n'est pas encore rattaché à un message : on laisse une heure avant de le juger orphelin.
const DEFAULT_MIN_AGE_MINUTES = 60;
const PAGE = 1000;
const FOLDER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Orphan = { path: string; size_bytes: number; created_at: string };
export type SkipReason = 'attached' | 'not_found' | 'too_recent';
export type PurgeResult = {
  deleted: string[];
  skipped: { path: string; reason: SkipReason }[];
};

type StorageFile = { name: string; created_at: string | null; metadata: unknown };

const sizeOf = (f: StorageFile) => {
  const size = (f.metadata as { size?: number } | null)?.size;
  return typeof size === 'number' ? size : 0;
};

function isOldEnough(createdAt: string | null, minAgeMinutes: number): boolean {
  if (!createdAt) return false;
  return Date.now() - Date.parse(createdAt) >= minAgeMinutes * 60_000;
}

/** Chemins parmi `paths` qui ont une ligne dans ticket_attachments. */
async function attachedAmong(paths: string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  const { data, error } = await createAdminClient()
    .from('ticket_attachments')
    .select('storage_path')
    .in('storage_path', paths);
  if (error) throw new Error(`purge: ${error.message}`);
  return new Set(data.map((r) => r.storage_path));
}

async function listFolder(dir: string | undefined): Promise<StorageFile[]> {
  const storage = createAdminClient().storage.from(ATTACHMENT_BUCKET);
  const all: StorageFile[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(dir, { limit: PAGE, offset });
    if (error) throw new Error(`purge: ${error.message}`);
    all.push(...data);
    if (data.length < PAGE) return all;
  }
}

/** Liste seulement : ne supprime jamais rien. */
export async function listOrphanAttachments(
  opts: { minAgeMinutes?: number } = {},
): Promise<Orphan[]> {
  const minAge = opts.minAgeMinutes ?? DEFAULT_MIN_AGE_MINUTES;
  const orphans: Orphan[] = [];
  for (const folder of await listFolder(undefined)) {
    if (!FOLDER_UUID.test(folder.name)) continue;
    const files = (await listFolder(folder.name)).filter(
      (f) => f.metadata && ATTACHMENT_PATH.test(`${folder.name}/${f.name}`),
    );
    const attached = await attachedAmong(files.map((f) => `${folder.name}/${f.name}`));
    for (const f of files) {
      const path = `${folder.name}/${f.name}`;
      if (attached.has(path) || !f.created_at || !isOldEnough(f.created_at, minAge)) continue;
      orphans.push({ path, size_bytes: sizeOf(f), created_at: f.created_at });
    }
  }
  return orphans;
}

/**
 * Suppression DÉFINITIVE, jamais automatique. Chaque chemin est revérifié ici (existe, non rattaché,
 * assez ancien) : la liste affichée à l'admin a pu changer entre-temps.
 */
export async function purgeOrphanAttachments(
  input: { paths: string[]; confirm: unknown; minAgeMinutes?: number },
  adminId: string,
): Promise<PurgeResult> {
  const parsed = purgeOrphansSchema.safeParse(input);
  if (!parsed.success) return apiError('VALIDATION_ERROR');
  const { paths, minAgeMinutes = DEFAULT_MIN_AGE_MINUTES } = parsed.data;
  const unique = [...new Set(paths)];
  const admin = createAdminClient();
  const attached = await attachedAmong(unique);
  const result: PurgeResult = { deleted: [], skipped: [] };
  const toRemove: string[] = [];
  for (const path of unique) {
    const slash = path.indexOf('/');
    const dir = path.slice(0, slash);
    const name = path.slice(slash + 1);
    const { data, error } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .list(dir, { search: name, limit: 5 });
    if (error) throw new Error(`purge: ${error.message}`);
    const file = data.find((f) => f.name === name);
    if (!file) result.skipped.push({ path, reason: 'not_found' });
    else if (attached.has(path)) result.skipped.push({ path, reason: 'attached' });
    else if (!isOldEnough(file.created_at, minAgeMinutes)) {
      result.skipped.push({ path, reason: 'too_recent' });
    } else toRemove.push(path);
  }
  if (toRemove.length > 0) {
    const { error } = await admin.storage.from(ATTACHMENT_BUCKET).remove(toRemove);
    if (error) throw new Error(`purge: ${error.message}`);
    result.deleted = toRemove;
    const { error: auditError } = await admin.from('audit_log').insert({
      actor_id: adminId,
      action: 'purge_orphan_attachments',
      target_table: 'storage.objects',
      details: { count: toRemove.length, paths: toRemove },
    });
    if (auditError) throw new Error(`audit: ${auditError.message}`);
  }
  return result;
}
