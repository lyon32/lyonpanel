import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTACHMENT_PATH } from '@/server/schemas/storage';

/*
 * Faille 5 : ATTACHMENT_PATH (src/server/schemas/storage.ts) doit être aussi strict que la règle de la base
 * (politique ticket_attachments_insert) : le point avant l'extension est un VRAI point.
 * Cause : `\.` dans un gabarit de chaîne JavaScript devient `.` ; correction : `\\.` ou String.raw.
 */

const U1 = '0b9f5f0e-3c1e-4c53-9a3a-5c1b8e9d2a11';
const U2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const ok = (ext: string) => `${U1}/${U2}.${ext}`;

describe('ATTACHMENT_PATH', () => {
  it.each(['jpg', 'png', 'webp'])('accepte un chemin valide en .%s', (ext) => {
    expect(ATTACHMENT_PATH.test(ok(ext))).toBe(true);
  });

  it.each([
    ['« Xpng » (point remplacé par une lettre)', `${U1}/${U2}Xpng`],
    ['« -jpg »', `${U1}/${U2}-jpg`],
    ['sans point', `${U1}/${U2}webp`],
    ['extension .jpgx', `${U1}/${U2}.jpgx`],
    ['préfixe Xjpg', `${U1}/${U2}.Xjpg`],
    ['extension svg', `${U1}/${U2}.svg`],
    ['majuscules', ok('PNG')],
    ['retour à la ligne final', `${ok('png')}\n`],
    ['dossier relatif', `../${U2}.png`],
    ['sans dossier client', `${U2}.png`],
  ])('refuse %s', (_label, path) => {
    expect(ATTACHMENT_PATH.test(path)).toBe(false);
  });

  it('contient un point littéral (\\.) comme la règle SQL de la base', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20261116110000_admin_phase11.sql'),
      'utf8',
    );
    expect(sql).toContain('\\.(jpg|png|webp)$');
    expect(ATTACHMENT_PATH.source).toContain('\\.(jpg|png|webp)$');
  });
});
