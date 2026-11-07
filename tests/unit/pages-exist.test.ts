import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

const root = join(process.cwd(), 'src/app/[locale]');
const groups = ['(app)', '(public)', '(auth)'];

// Chaque adresse déclarée dans routing.pathnames doit avoir une vraie page, sinon 404.
describe('pages des adresses traduites', () => {
  const internal = Object.keys(routing.pathnames).filter((p) => p !== '/');
  it.each(internal)('%s a un fichier page', (path) => {
    const found = groups.some((g) => existsSync(join(root, g, path, 'page.tsx')));
    expect(found).toBe(true);
  });

  it('a une page fourre-tout qui déclenche le 404 du site', () => {
    expect(existsSync(join(root, '[...rest]', 'page.tsx'))).toBe(true);
  });
});
