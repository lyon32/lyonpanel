// Remise appliquée : la plus grande de l'automatique et de la personnalisée, jamais cumulées.
export interface AutoDiscount {
  thresholdXaf: number;
  pct: number;
}

export function resolveDiscountPct(
  totalRechargedXaf: number,
  auto: AutoDiscount,
  customPct: number | null,
): number {
  const autoPct = totalRechargedXaf >= auto.thresholdXaf ? auto.pct : 0;
  return Math.max(autoPct, customPct ?? 0);
}

// Seuil à atteindre pour la remise automatique, ou null si la barre n'a plus de sens
// (seuil atteint, ou remise personnalisée déjà au moins égale à l'automatique).
export function nextDiscountThresholdXaf(
  totalRechargedXaf: number,
  auto: AutoDiscount,
  customPct: number | null,
): number | null {
  if (totalRechargedXaf >= auto.thresholdXaf) return null;
  if ((customPct ?? 0) >= auto.pct) return null;
  return auto.thresholdXaf;
}
