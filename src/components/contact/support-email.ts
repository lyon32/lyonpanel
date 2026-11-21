// Format simple : évite d'afficher ou de placer dans un lien mailto une valeur de configuration douteuse.
const EMAIL_FORMAT = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

/** Retourne l'adresse nettoyée si elle a un format e-mail valide, sinon undefined. */
export function validSupportEmail(value: string | undefined): string | undefined {
  const email = value?.trim();
  return email && EMAIL_FORMAT.test(email) ? email : undefined;
}
