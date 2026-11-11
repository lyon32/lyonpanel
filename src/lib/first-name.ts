// Le profil n'a pas de prénom : on en tire un de l'adresse email quand elle ressemble à un prénom
// (lettres seulement, avant un chiffre, un point ou un tiret). Sinon on ne dit que « Bonjour ».
export function firstNameFromEmail(email: string | null | undefined): string | undefined {
  const local = email?.split('@')[0] ?? '';
  const match = /^\p{L}{2,20}/u.exec(local);
  if (!match) return undefined;
  const word = match[0];
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
