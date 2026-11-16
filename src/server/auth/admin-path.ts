/**
 * Vrai seulement si `segment` est exactement l'adresse secrète de l'admin.
 * Sans ADMIN_PATH (absent ou vide) tout est refusé, même un segment vide : l'admin est alors fermé.
 * Module sans dépendance serveur : le proxy l'utilise aussi.
 */
export function isAdminSegment(
  segment: string | undefined,
  adminPath: string | undefined,
): boolean {
  if (!segment || !adminPath) return false;
  if (segment.length !== adminPath.length) return false;
  // Comparaison sans sortie anticipée : le temps ne révèle pas combien de caractères sont justes.
  let diff = 0;
  for (let i = 0; i < segment.length; i++) diff |= segment.charCodeAt(i) ^ adminPath.charCodeAt(i);
  return diff === 0;
}
