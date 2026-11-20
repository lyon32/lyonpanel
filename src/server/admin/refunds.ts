// Fonction pure, sans accès base : testable seule et utilisable côté écran.
/**
 * Part non livrée, en entiers XAF : arrondie vers le bas (jamais plus que le dû),
 * moins ce qui a déjà été rendu, entre 0 et le montant payé.
 * Même formule que la fonction SQL `refund_order`, qui reste la barrière finale.
 */
export function refundableAmountXaf(input: {
  chargedXaf: number;
  quantity: number;
  remains: number;
  refundedXaf: number;
}): number {
  const { chargedXaf, quantity, refundedXaf } = input;
  const remains = Math.min(Math.max(input.remains, 0), quantity);
  const due = Math.floor((chargedXaf * remains) / quantity);
  return Math.max(0, Math.min(due, chargedXaf) - refundedXaf);
}
