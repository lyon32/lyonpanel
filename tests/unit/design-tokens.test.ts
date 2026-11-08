import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

// Valeur d'une variable CSS (dernière déclaration), sans espaces superflus.
function tokenValue(name: string): string | undefined {
  const re = new RegExp(`${name}\s*:\s*([^;]+);`, 'gi');
  const all = [...css.matchAll(re)];
  return all.at(-1)?.[1]?.trim().replace(/\s+/g, ' ');
}

function expectTokens(tokens: Record<string, string>) {
  for (const [name, value] of Object.entries(tokens)) {
    const actual = tokenValue(name);
    expect(actual?.toLowerCase(), `${name} doit valoir ${value}`).toBe(value.toLowerCase());
  }
}

describe('variables de couleur (docs/05 §1 et §8)', () => {
  it('définit le blanc, le bleu et ses nuances', () => {
    expectTokens({
      '--blanc': '#FFFFFF',
      '--bleu-50': '#EFF4FF',
      '--bleu-100': '#DBE6FE',
      '--bleu-600': '#1D4ED8',
      '--bleu-700': '#1A3FB0',
      '--bleu-900': '#14286B',
    });
  });

  it('définit les nuances de jaune', () => {
    expectTokens({ '--jaune-50': '#FDF7EA', '--jaune-500': '#D9A23B', '--jaune-700': '#A87A22' });
  });

  it('définit les neutres', () => {
    expectTokens({
      '--encre': '#0E1726',
      '--gris-600': '#475467',
      '--gris-400': '#98A2B3',
      '--gris-200': '#E4E7EC',
      '--gris-50': '#F8FAFC',
    });
  });

  it('définit les couleurs de statut', () => {
    expectTokens({ '--succes': '#067647', '--erreur': '#B42318' });
  });
});

describe('formes et espacements (docs/05 §3)', () => {
  it('définit les rayons 8 px et 12 px', () => {
    expectTokens({ '--rayon': '8px', '--rayon-carte': '12px' });
  });

  it('définit les espacements 4, 8, 12, 16, 24, 32, 48, 64 px', () => {
    expectTokens({
      '--espace-1': '4px',
      '--espace-2': '8px',
      '--espace-3': '12px',
      '--espace-4': '16px',
      '--espace-5': '24px',
      '--espace-6': '32px',
      '--espace-7': '48px',
      '--espace-8': '64px',
    });
  });
});

describe('tailles de titres (docs/05 §2)', () => {
  it('définit H1 28/40, H2 22/28, H3 18/20 (mobile/ordinateur)', () => {
    expectTokens({
      '--titre-h1-mobile': '28px',
      '--titre-h1-bureau': '40px',
      '--titre-h2-mobile': '22px',
      '--titre-h2-bureau': '28px',
      '--titre-h3-mobile': '18px',
      '--titre-h3-bureau': '20px',
    });
  });
});

describe('polices (docs/05 §2)', () => {
  it('--police : Public Sans avec secours system-ui', () => {
    const v = tokenValue('--police') ?? '';
    expect(v).toMatch(/^"?Public Sans"?/);
    expect(v).toContain('system-ui');
  });

  it('--police-secondaire : Atkinson Hyperlegible avec secours system-ui', () => {
    const v = tokenValue('--police-secondaire') ?? '';
    expect(v).toMatch(/^"?Atkinson Hyperlegible"?/);
    expect(v).toContain('system-ui');
  });

  it('--police-mono : IBM Plex Mono avec secours system-ui ou monospace', () => {
    const v = tokenValue('--police-mono') ?? '';
    expect(v).toMatch(/^"?IBM Plex Mono"?/);
    expect(v).toMatch(/system-ui|monospace/);
  });
});

describe('mode sombre', () => {
  it("n'a aucune règle prefers-color-scheme: dark", () => {
    expect(css).not.toMatch(/prefers-color-scheme\s*:\s*dark/i);
  });
});
