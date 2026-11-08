import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let common: Set<string> | null = null;

/** Chargée à la première utilisation seulement (fichier de ~300 Ko). */
function loadCommon(): Set<string> {
  if (!common) {
    const text = readFileSync(join(process.cwd(), 'data', 'common-passwords.txt'), 'utf8');
    common = new Set(
      text
        .split(/\r?\n/)
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return common;
}

/** Vrai si le mot de passe figure dans la liste des mots de passe courants (casse ignorée). */
export function isCommonPassword(password: string): boolean {
  return loadCommon().has(password.toLowerCase());
}
