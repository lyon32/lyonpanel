// Durée minimale d'une connexion : compte connu, inconnu, bon ou mauvais mot de passe
// répondent en même temps, pour qu'on ne devine pas quels comptes existent.
export const MIN_AUTH_DURATION_MS = 300;

/** Plancher (pas un ajout) : une fonction plus lente n'est pas rallongée ; l'erreur est relancée telle quelle. */
export async function withMinDuration<T>(minMs: number, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const wait = async () => {
    const remaining = minMs - (Date.now() - start);
    if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  };
  try {
    const result = await fn();
    await wait();
    return result;
  } catch (error) {
    await wait();
    throw error;
  }
}
