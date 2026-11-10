import 'server-only';
import { flagForReview } from './flag-for-review';
import { createAdminClient } from '@/server/db/supabase-admin';
import { getProvider } from '@/server/providers';
import type { ProviderStatus } from '@/server/providers/types';

const BATCH_SIZE = 100;
const PROVIDER_TIMEOUT_MS = 10_000;

type Counters = { checked: number; completed: number; flagged: number; failedBatches: number };
type Row = {
  id: string;
  short_id: string;
  service_id: number;
  charged_xaf: number;
  provider_order_id: number;
};

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), PROVIDER_TIMEOUT_MS);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

// Le fournisseur renvoie parfois des nombres en texte ; null si absent ou illisible.
const toInt = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null;
};

async function applyStatus(row: Row, st: ProviderStatus, c: Counters): Promise<void> {
  const startCount = toInt(st.start_count);
  const remains = toInt(st.remains);
  const progress = { start_count: startCount, remains };
  const db = createAdminClient();
  if (st.status === 'Completed' || st.status === 'Pending' || st.status === 'In progress') {
    const status = st.status === 'Completed' ? 'completed' : 'in_progress';
    // Garde sur le statut : on n'écrase jamais une commande déjà passée en to_review.
    await db
      .from('orders')
      .update({ status, ...progress })
      .eq('id', row.id)
      .eq('status', 'in_progress');
    if (status === 'completed') c.completed += 1;
    return;
  }
  // Partial, Canceled ou inconnu : jamais ignoré, le propriétaire examine (pas de remboursement auto).
  const reason = `provider status: ${st.status}`.slice(0, 300);
  if (await flagForReview(row, { status: 'in_progress' }, reason, progress)) c.flagged += 1;
}

/**
 * Synchronise les commandes `in_progress` avec le fournisseur, par lots de 100.
 * Rejouable, aucune écriture de solde. Une erreur sur un lot ou une commande n'arrête pas les autres.
 */
export async function syncOrderStatuses(): Promise<Counters> {
  const c: Counters = { checked: 0, completed: 0, flagged: 0, failedBatches: 0 };
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('id, short_id, service_id, charged_xaf, provider_order_id')
    .eq('status', 'in_progress')
    .not('provider_order_id', 'is', null)
    .order('created_at', { ascending: true });
  if (error || !data) return c;
  const rows = data as Row[];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    let answers: Record<number, ProviderStatus>;
    try {
      answers = await withTimeout(getProvider().status(batch.map((r) => r.provider_order_id)));
    } catch {
      c.failedBatches += 1;
      continue;
    }
    for (const row of batch) {
      const st = answers[row.provider_order_id];
      if (!st) continue;
      c.checked += 1;
      try {
        await applyStatus(row, st, c);
      } catch {
        // Commande isolée en erreur : le prochain passage la reverra.
      }
    }
  }
  return c;
}
