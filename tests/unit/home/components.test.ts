import { describe, expect, it } from 'vitest';
import { exists, listFiles, read, sizeOf } from './helpers';

const HOME = 'src/components/home';
const homeSrc = () => listFiles(HOME).filter((f) => /\.(tsx?|css)$/.test(f));
const allHome = () => homeSrc().map(read).join('\n');
const statsDef = () => homeSrc().filter((f) => /export const PLACEHOLDER_STATS\b/.test(read(f)));

describe('accueil : composants dans src/components/home', () => {
  it('le héros existe', () => {
    expect(exists(`${HOME}/hero.tsx`)).toBe(true);
  });
  it('le héros porte un seul h1 et lie vers register et l’ancre « comment ça marche »', () => {
    const hero = read(`${HOME}/hero.tsx`);
    expect(hero.match(/<h1[\s>]/g)?.length).toBe(1);
    expect(hero).toMatch(/register|inscription/);
    expect(hero).toMatch(/#(how|comment-ca-marche|how-it-works|steps)/);
  });
  it('un seul h1 dans tous les composants home', () => {
    const total = homeSrc().reduce((n, f) => n + (read(f).match(/<h1[\s>]/g)?.length ?? 0), 0);
    expect(total).toBe(1);
  });
  it('textes branchés sur messages : plus de copy.ts, usage de useTranslations/getTranslations', () => {
    expect(exists(`${HOME}/copy.ts`)).toBe(false);
    expect(allHome()).toMatch(/useTranslations|getTranslations/);
  });
  it('aucune ancienne couleur (#1D4ED8, jaune) dans src/components/home', () => {
    expect(homeSrc().length).toBeGreaterThan(0);
    expect(allHome()).not.toMatch(/#1D4ED8/i);
    expect(allHome()).not.toMatch(/#(FACC15|FDE047|FBBF24|FFD700|EAB308)/i);
    expect(allHome()).not.toMatch(/\b(bg|text|border)-(yellow|amber)-\d+/);
  });
  it('aucun nom de fournisseur dans src/components/home', () => {
    expect(homeSrc().length).toBeGreaterThan(0);
    expect(allHome()).not.toMatch(/justanotherpanel|\bJAP\b/i);
  });
});

describe('accueil : chiffres d’exemple', () => {
  it('PLACEHOLDER_STATS est exporté une seule fois, avec le commentaire de remplacement', () => {
    const defs = statsDef();
    expect(defs).toHaveLength(1);
    expect(read(defs[0]!)).toContain('À REMPLACER PAR LES VRAIS CHIFFRES AVANT LA MISE EN LIGNE');
  });
  it('les valeurs d’exemple ne sont écrites en dur nulle part ailleurs', async () => {
    const [def] = statsDef();
    expect(def).toBeDefined();
    const mod = (await import(/* @vite-ignore */ `../../../${def!.replace(/\.ts$/, '')}`)) as {
      PLACEHOLDER_STATS: Record<string, number>;
    };
    for (const f of homeSrc().filter((x) => x !== def)) {
      for (const v of Object.values(mod.PLACEHOLDER_STATS)) {
        expect(read(f), `${f} contient ${v}`).not.toMatch(new RegExp(`\\b${v}\\b`));
      }
    }
  });
  it('le composant des chiffres affiche la pastille « Exemple » avec PLACEHOLDER_STATS', () => {
    const f = homeSrc().find((x) => /PLACEHOLDER_STATS/.test(read(x)) && x.endsWith('.tsx'));
    expect(f, 'un composant .tsx doit utiliser PLACEHOLDER_STATS').toBeDefined();
    expect(read(f!)).toMatch(/['"]example['"]|home\.example/);
  });
});

describe('accueil : tuiles de services', () => {
  const EXPECTED = {
    instagram: 822,
    tiktok: 547,
    youtube: 261,
    facebook: 308,
    telegram: 144,
    x: 57,
    whatsapp: 3,
    spotify: 3,
    twitch: 6,
    linkedin: 4,
  };
  it('les nombres par réseau correspondent au catalogue', async () => {
    const { NETWORKS } = (await import('@/components/home/networks')) as {
      NETWORKS: { id: string; count: number }[];
    };
    expect(Object.fromEntries(NETWORKS.map((n) => [n.id, n.count]))).toEqual(EXPECTED);
  });
  it('le catalogue compte 2 188 services et les tuiles le lisent', () => {
    const json = JSON.parse(read('data/catalogue-resume.json')) as { total: number };
    expect(json.total).toBe(2188);
    expect(allHome()).toMatch(/catalogue-resume\.json/);
  });
  it('chaque réseau a un SVG réel et les tuiles l’utilisent (pas d’initiales)', async () => {
    const { NETWORKS } = (await import('@/components/home/networks')) as {
      NETWORKS: { id: string }[];
    };
    for (const n of NETWORKS) expect(exists(`public/brand/networks/${n.id}.svg`), n.id).toBe(true);
    expect(allHome()).toMatch(/\/brand\/networks\//);
  });
});

describe('accueil : paiements et images', () => {
  it.each(['wave', 'orange-money', 'mtn-momo', 'moov-money', 'airtel-money', 'visa', 'mastercard'])(
    'le logo %s existe dans public/brand/payments',
    (name) => {
      const files = listFiles('public/brand/payments').map((f) => f.split('/').pop()!);
      expect(files.some((f) => f.startsWith(name))).toBe(true);
    },
  );
  it('chaque image de public/images/home pèse au plus 200 Ko', () => {
    const files = listFiles('public/images/home');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(sizeOf(f), f).toBeLessThanOrEqual(200 * 1024);
  });
});
