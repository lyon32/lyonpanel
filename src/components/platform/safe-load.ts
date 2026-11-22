export type SafeResult<T> = { ok: true; value: T } | { ok: false };

// Une panne de base ne doit jamais devenir une page 500 : la page affiche un message propre.
export async function safeLoad<T>(load: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, value: await load() };
  } catch {
    return { ok: false };
  }
}
