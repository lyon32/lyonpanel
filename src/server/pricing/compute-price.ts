// Calcul des prix en entiers (BigInt) : aucune erreur de virgule flottante sur l'argent.
// Coût en 1/10 000 $, taux en 1/1 000, multiplicateur en 1/100.

const MIN_XAF = 5n;
const STEP_XAF = 5n;

function scaled(value: number, factor: number, label: string): bigint {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} invalide : ${value}`);
  const n = BigInt(Math.round(value * factor));
  if (n <= 0n) throw new Error(`${label} trop petit : ${value}`);
  return n;
}

// Arrondi au multiple de 5 supérieur de num/den, minimum 5.
function ceilToStep(num: bigint, den: bigint): number {
  const steps = (num + den * STEP_XAF - 1n) / (den * STEP_XAF);
  const total = steps * STEP_XAF;
  return Number(total < MIN_XAF ? MIN_XAF : total);
}

function parseCost(cost: number | string): number {
  if (typeof cost === 'number') return cost;
  return cost.trim() === '' ? Number.NaN : Number(cost);
}

export function computePricePer1000Xaf(
  costUsd1000: number | string,
  usdXafRate: number,
  multiplier: number,
): number {
  const cost = parseCost(costUsd1000);
  if (!Number.isFinite(cost) || cost < 0) throw new Error(`Coût invalide : ${costUsd1000}`);
  const costInt = BigInt(Math.round(cost * 10_000));
  const rateInt = scaled(usdXafRate, 1000, 'Taux');
  const multInt = scaled(multiplier, 100, 'Multiplicateur');
  return ceilToStep(costInt * rateInt * multInt, 1_000_000_000n);
}

function assertPositiveInt(value: number, label: string): bigint {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} invalide : ${value}`);
  return BigInt(value);
}

export function computeOrderTotalXaf(pricePer1000Xaf: number, quantity: number): number {
  const price = assertPositiveInt(pricePer1000Xaf, 'Prix');
  const qty = assertPositiveInt(quantity, 'Quantité');
  return ceilToStep(price * qty, 1000n);
}

export function computeMinOrderXaf(pricePer1000Xaf: number, minQty: number): number {
  return computeOrderTotalXaf(pricePer1000Xaf, minQty);
}
