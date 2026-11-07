// Affichage seul : le solde est déjà formaté par l'appelant.
export function BalanceBadge({ balanceLabel }: { balanceLabel: string }) {
  return (
    <span className="border-gris-200 text-encre rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums">
      {balanceLabel}
    </span>
  );
}
