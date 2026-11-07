export type OrderOverrides = Record<string, unknown>;

// Coquille : la table orders arrive avec la tâche 1.2.
export async function makeOrder(
  userId: string,
  serviceId: number,
  overrides: OrderOverrides = {},
): Promise<never> {
  void userId;
  void serviceId;
  void overrides;
  throw new Error('makeOrder : table orders absente (tâche 1.2)');
}
