/** Garde explicite pour noUncheckedIndexedAccess : échoue clairement si la valeur manque. */
export function must<T>(value: T | undefined | null, label = 'valeur'): T {
  if (value === undefined || value === null) throw new Error(`${label} absente`);
  return value;
}
