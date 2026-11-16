// Bonus de parrainage : pct % du montant crédité, arrondi à l'inférieur, en entiers (BigInt).
// Doit rester identique à credit_payment (SQL) : floor(montant × pct / 100).
export function computeReferralBonusXaf(creditedXaf: number, pct: number): number {
  if (!Number.isSafeInteger(creditedXaf) || creditedXaf < 0) {
    throw new Error(`Montant invalide : ${creditedXaf}`);
  }
  if (!Number.isFinite(pct) || pct < 0 || pct > 100)
    throw new Error(`Pourcentage invalide : ${pct}`);
  // Centièmes de % pour rester en entiers même avec un pourcentage décimal.
  const pctBp = BigInt(Math.round(pct * 100));
  return Number((BigInt(creditedXaf) * pctBp) / 10_000n);
}
