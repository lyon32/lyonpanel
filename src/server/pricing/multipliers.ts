// Choix du multiplicateur : surcharge du service > règle (réseau, type) > défaut du réglage.

export type MultiplierRule = { platform: string; category: string; multiplier: number };

type ResolveInput = {
  override?: number | null;
  platform: string;
  category: string;
  rules: readonly MultiplierRule[];
  defaultMultiplier: number;
};

function assertValid(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} invalide : ${value} (doit être un nombre fini > 0)`);
  }
  return value;
}

export function resolveMultiplier(input: ResolveInput): number {
  if (input.override !== undefined && input.override !== null) {
    return assertValid(input.override, 'Surcharge du multiplicateur');
  }
  const rule = input.rules.find(
    (r) => r.platform === input.platform && r.category === input.category,
  );
  if (rule) return assertValid(rule.multiplier, 'Multiplicateur de la règle');
  return assertValid(input.defaultMultiplier, 'Multiplicateur par défaut');
}
