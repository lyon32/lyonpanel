// Affichage seul : le solde est déjà formaté par l'appelant.
export function BalanceBadge({ balanceLabel }: { balanceLabel: string }) {
  return (
    <span
      data-testid="header-balance"
      className="border-gris-200 text-encre inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold whitespace-nowrap tabular-nums"
    >
      {balanceLabel}
    </span>
  );
}
