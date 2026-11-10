// Total d'une commande après remise, en entiers (BigInt) : aucun flottant sur l'argent.
// Doit rester identique à place_order (SQL) :
//   ceil(prix_1000 × qté × (100 − remise) / 100000 / 5) × 5, minimum 5 XAF.

const MIN_XAF = 5n;
const STEP_XAF = 5n;

function positiveInt(value: number, label: string): bigint {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} invalide : ${value}`);
  return BigInt(value);
}

export function computeDiscountedTotalXaf(
  pricePer1000Xaf: number,
  quantity: number,
  discountPct: number,
): number {
  const price = positiveInt(pricePer1000Xaf, 'Prix');
  const qty = positiveInt(quantity, 'Quantité');
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
    throw new Error(`Remise invalide : ${discountPct}`);
  }
  // Remise en centièmes de % (ex. 12,5 % -> 1250) pour rester en entiers.
  const discountBp = BigInt(Math.round(discountPct * 100));
  const num = price * qty * (10_000n - discountBp);
  const den = 10_000n * 1000n * STEP_XAF;
  const total = ((num + den - 1n) / den) * STEP_XAF;
  return Number(total < MIN_XAF ? MIN_XAF : total);
}
