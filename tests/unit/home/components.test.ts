import { describe, expect, it } from 'vitest';
import { exists, listFiles, read, sizeOf } from './helpers';

const HOME = 'src/components/home';
const homeSrc = () => listFiles(HOME).filter((f) => /\.(tsx?|css)$/.test(f));
const allHome = () => homeSrc().map(read).join('\n');

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

describe('accueil : vrais chiffres (phase 15.1)', () => {
  it('PLACEHOLDER_STATS n’existe plus nulle part dans src/components/home', () => {
    expect(allHome()).not.toMatch(/PLACEHOLDER_STATS/);
    expect(allHome()).not.toContain('À REMPLACER PAR LES VRAIS CHIFFRES');
  });
  it('les anciens chiffres inventés (48200, 6400, pays) ont disparu', () => {
    expect(allHome()).not.toMatch(/(48200|6400)/);
    expect(allHome()).not.toMatch(/countries/);
  });
  it('plus aucune pastille « Exemple » sur les chiffres', () => {
    const f = homeSrc().filter((x) => x.endsWith('sections.tsx'));
    expect(f).toHaveLength(1);
    expect(read(f[0]!)).not.toMatch(/tr\('example'\)|home\.example|data-exemple/);
  });
  it('les chiffres viennent des messages, sans nombre en dur', () => {
    const src = read(`${HOME}/sections.tsx`);
    expect(src).toMatch(/stats.(clients|orders)/);
    expect(src).not.toMatch(/(100|2000)/);
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
