import { describe, expect, it } from 'vitest';
import { splitServiceName } from '@/lib/split-service-name';

describe('splitServiceName', () => {
  it('sépare le nom et le numéro', () => {
    expect(splitServiceName('Abonnés TikTok #9747146')).toEqual({
      title: 'Abonnés TikTok',
      ref: '9747146',
    });
  });
  it('garde les « · » du nom et ignore les espaces en trop', () => {
    expect(splitServiceName('Abonnés Instagram · Réel · Recharge #35452 ')).toEqual({
      title: 'Abonnés Instagram · Réel · Recharge',
      ref: '35452',
    });
  });
  it('sans numéro : nom inchangé, ref nulle', () => {
    expect(splitServiceName('Abonnés TikTok')).toEqual({ title: 'Abonnés TikTok', ref: null });
  });
  it('un # au milieu ou non numérique n’est pas un numéro', () => {
    expect(splitServiceName('Pack #1 premium')).toEqual({ title: 'Pack #1 premium', ref: null });
    expect(splitServiceName('Service #abc')).toEqual({ title: 'Service #abc', ref: null });
  });
  it('nom vide ou réduit au numéro : pas de plantage', () => {
    expect(splitServiceName('')).toEqual({ title: '', ref: null });
    expect(splitServiceName('#123')).toEqual({ title: '#123', ref: null });
  });
});
