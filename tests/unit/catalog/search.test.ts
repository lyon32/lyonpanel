import { describe, expect, it } from 'vitest';
import { resolvePage } from '@/server/catalog/resolve-page';
import { searchServices } from '@/server/catalog/search';

const list = [
  { id: 1, name: "Abonnés Instagram · J'aime #1" },
  { id: 22, name: 'Followers TikTok #22' },
  { id: 333, name: 'Vues YouTube #333' },
];

describe('searchServices', () => {
  it.each([
    ['abonnes', [1]],
    ['ABONNÉS', [1]],
    ['jaime', [1]],
    ["J'aime", [1]],
    ['#22', [22]],
    ['22', [22]],
    ['followers  tiktok', [22]],
    ['vues', [333]],
  ])('« %s »', (q, ids) => {
    expect(searchServices(list, q).map((s) => s.id)).toEqual(ids);
  });

  it('une recherche vide ou de ponctuation seule renvoie tout', () => {
    expect(searchServices(list, '')).toHaveLength(3);
    expect(searchServices(list, " ' ")).toHaveLength(3);
  });

  it('coupe la recherche à 60 caractères', () => {
    expect(searchServices(list, `abonnes${' '.repeat(80)}zzz`)).toHaveLength(1);
  });
});

describe('resolvePage', () => {
  it.each([
    [undefined, 5, 1, true],
    ['2', 5, 2, true],
    ['5', 5, 5, true],
    ['6', 5, 5, false],
    ['0', 5, 1, false],
    ['-1', 5, 1, false],
    ['abc', 5, 1, false],
    ['1.5', 5, 1, false],
    ['1', 5, 1, false],
    ['02', 5, 1, false],
    ['3', 1, 1, false],
    ['99999999999999999999', 5, 1, false],
  ])('page=%s sur %i pages', (raw, total, page, canonical) => {
    expect(resolvePage(raw, total)).toEqual({ page, canonical });
  });
});
