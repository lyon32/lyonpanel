import type { AttemptStore } from '@/server/auth/rate-limit';

export type MemoryRow = {
  id: number;
  identifierHash: string;
  ipHash: string;
  success: boolean;
  createdAt: number;
};

/**
 * Faux stockage en mémoire, mêmes règles que la table login_attempts.
 * Chaque opération rend la main (setTimeout) pour que des appels parallèles s'entrelacent comme en vrai.
 */
export function memoryStore() {
  const rows: MemoryRow[] = [];
  let nextId = 1;
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const last = (list: MemoryRow[]) =>
    list.length ? new Date(Math.max(...list.map((r) => r.createdAt))) : null;
  const store: AttemptStore = {
    async countFailures({ identifierHash, ipHash, since, excludeId }) {
      await tick();
      const fails = rows.filter(
        (r) => !r.success && r.createdAt >= since.getTime() && r.id !== excludeId,
      );
      const byId = fails.filter((r) => r.identifierHash === identifierHash);
      const byIp = fails.filter((r) => r.ipHash === ipHash);
      return {
        byIdentifier: byId.length,
        byIp: byIp.length,
        lastIdentifierAt: last(byId),
        lastIpAt: last(byIp),
      };
    },
    async record({ identifierHash, ipHash, success }) {
      await tick();
      const id = nextId++;
      rows.push({ id, identifierHash, ipHash, success, createdAt: Date.now() });
      return { id };
    },
    async markSuccess(id) {
      await tick();
      const row = rows.find((r) => r.id === id);
      if (row) row.success = true;
    },
    async discard(id) {
      await tick();
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
  };
  return { store, rows };
}
