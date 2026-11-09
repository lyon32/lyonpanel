import { describe, expect, it } from 'vitest';
import { buildRows, toCsv } from '../../../scripts/catalogue/generate';

const sample = [
  {
    service: 7,
    name: 'Instagram Followers [Refill 30D] SecretNom',
    type: 'Default',
    rate: 1.5,
    min: 10,
    max: 1000,
    dripfeed: false,
    refill: true,
    cancel: false,
    category: 'Instagram',
  },
];

describe('génération du catalogue', () => {
  it('applique taux 600 et multiplicateur 3, arrondi au multiple de 5', () => {
    const [row] = buildRows(sample);
    expect(row).toMatchObject({ platform: 'instagram', category: 'followers', priceXaf1000: 2700 });
    expect(row?.minOrderXaf).toBe(30);
  });

  it('passe le nom et la catégorie fournisseur à buildServiceName (qualificatifs dans le nom)', () => {
    const [row] = buildRows(sample);
    expect(row?.name).toBe('Abonnés Instagram · Garantie 30 j · Recharge #7');
  });

  it('distingue deux services qui ne diffèrent que par le nom fournisseur', () => {
    const [a, b] = buildRows([
      { ...sample[0]!, service: 8, name: 'Instagram Followers USA Real', refill: false },
      { ...sample[0]!, service: 9, name: 'Instagram Followers India HQ', refill: false },
    ]);
    expect(a?.name.replace(/ #d+$/, '')).not.toBe(b?.name.replace(/ #d+$/, ''));
    expect(a?.name).toBe('Abonnés Instagram · Réel · États-Unis #8');
  });

  it("n'écrit jamais le nom d'origine dans le CSV", () => {
    const csv = toCsv(buildRows(sample));
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).not.toContain('SecretNom');
  });
});
