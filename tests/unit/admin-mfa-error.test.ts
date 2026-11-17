import { describe, expect, it } from 'vitest';
import { mfaCodeErrorKey } from '@/components/admin/admin-api';

describe('mfaCodeErrorKey', () => {
  it('429 RATE_LIMITED donne le message de verrou', () => {
    const data = { error: { code: 'RATE_LIMITED', message: 'x' } };
    expect(mfaCodeErrorKey({ ok: false, status: 429, data })).toBe('code.locked');
  });
  it('429 sans corps donne aussi le verrou', () => {
    expect(mfaCodeErrorKey({ ok: false, status: 429, data: null })).toBe('code.locked');
  });
  it('un autre échec donne le message de code incorrect', () => {
    expect(mfaCodeErrorKey({ ok: false, status: 400, data: null })).toBe('code.error');
    expect(mfaCodeErrorKey({ ok: false, status: 0, data: null })).toBe('code.error');
  });
});
