import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '@/lib/constants';

describe('SITE_NAME', () => {
  it('expose le nom du site', () => {
    expect(SITE_NAME).toBe('LyonPanel');
  });
});
