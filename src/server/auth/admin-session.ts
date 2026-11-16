// Durée maximale d'une session admin. Supabase l'impose aussi (auth.sessions timebox = 12h).
export const ADMIN_SESSION_HOURS = 12;

/** Une date illisible est considérée comme expirée : dans le doute, on refuse l'accès. */
export function isAdminSessionExpired(signedInAt: string | Date, now: Date = new Date()): boolean {
  const start = new Date(signedInAt).getTime();
  if (Number.isNaN(start)) return true;
  return now.getTime() - start >= ADMIN_SESSION_HOURS * 3_600_000;
}
