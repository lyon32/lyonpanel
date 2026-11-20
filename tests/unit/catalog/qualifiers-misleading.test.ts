import { describe, expect, it } from 'vitest';
import { extractQualifiers } from '@/server/catalog/qualifiers';
import { buildServiceName } from '@/server/catalog/build-name';

describe('qualificatifs trompeurs', () => {
  it('« 1 Minutes Completed » sur des abonnés ne donne pas « 1 min »', () => {
    const q = extractQualifiers('TikTok Followers | 1 Minutes Completed', undefined, 'fr');
    expect(q.join(' ')).not.toMatch(/min/);
  });
  it('garde la durée pour des vues ou un live', () => {
    expect(extractQualifiers('Live Stream Views 60 Minutes', undefined, 'en')).toContain('60 min');
  });
  it('n affiche pas une vitesse supérieure à 10M par jour', () => {
    expect(extractQualifiers('Views Speed: 100M/Day', undefined, 'en').join(' ')).not.toMatch(
      /100M/,
    );
    expect(extractQualifiers('Views Speed: 10M/Day', undefined, 'en')).toContain('10M/day');
  });
  it('FR et EN retirent les mêmes qualificatifs quand le nom est trop long', () => {
    const service = {
      id: 1,
      platform: 'facebook' as const,
      category: 'comments' as const,
      refill: false,
      cancel: true,
      dripfeed: false,
      min_qty: 10,
      max_qty: 1000,
      providerName: 'High Quality | No Drop | Instant | Speed 2K/Day | Max 500K',
    };
    const count = (s: string) => s.split(' · ').length;
    expect(count(buildServiceName(service, 'fr'))).toBe(count(buildServiceName(service, 'en')));
  });
});
