import { describe, expect, it } from 'vitest';
import { exists, listFiles, read } from './helpers';

describe('palette sombre sur le site public', () => {
  it.each([
    ['accueil, Services, Blog (layout public)', 'src/app/[locale]/(public)/layout.tsx'],
    ['connexion / inscription (coque auth)', 'src/components/auth/auth-shell.tsx'],
    ['404', 'src/app/[locale]/not-found.tsx'],
  ])('%s porte la classe lp-app', (_n, file) => {
    expect(read(file)).toContain('lp-app');
  });
});

describe('prototypes', () => {
  it.each(['a', 'b', 'c', 'd', 'f'])('le prototype %s est supprimé', (p) => {
    expect(exists(`src/components/prototypes/${p}`)).toBe(false);
    expect(exists(`src/app/[locale]/prototypes/${p}`)).toBe(false);
  });
  it('la page prototypes/e reste mais en noindex', () => {
    const page = 'src/app/[locale]/prototypes/e/page.tsx';
    expect(exists(page)).toBe(true);
    expect(read(page)).toMatch(/robots:\s*\{\s*index:\s*false/);
  });
  it('seul le prototype e subsiste dans src/components/prototypes (ou rien)', () => {
    const rest = listFiles('src/components/prototypes').filter(
      (f) => !f.includes('/prototypes/e/'),
    );
    expect(rest).toEqual([]);
  });
});
