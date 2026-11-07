export type PaymentOverrides = Record<string, unknown>;

// Coquille : la table payments arrive avec la tâche 1.2.
export async function makePayment(
  userId: string,
  overrides: PaymentOverrides = {},
): Promise<never> {
  void userId;
  void overrides;
  throw new Error('makePayment : table payments absente (tâche 1.2)');
}
