export type ServiceOverrides = Record<string, unknown>;

// Coquille : la table services arrive avec la tâche 1.2.
export async function makeService(overrides: ServiceOverrides = {}): Promise<never> {
  void overrides;
  throw new Error('makeService : table services absente (tâche 1.2)');
}
