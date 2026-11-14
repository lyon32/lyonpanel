import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { keysetFilter } from '@/server/orders/list-orders';

const cursor = {
  createdAt: '2026-11-13T10:00:00+00:00',
  id: '11111111-1111-1111-1111-111111111111',
};

describe('keysetFilter', () => {
  it('garde created_at par défaut (commandes, transactions)', () => {
    expect(keysetFilter(cursor)).toBe(
      'created_at.lt.2026-11-13T10:00:00Z,and(created_at.eq.2026-11-13T10:00:00Z,id.lt.11111111-1111-1111-1111-111111111111)',
    );
  });
  it('accepte une autre colonne (tickets : updated_at)', () => {
    expect(keysetFilter(cursor, 'updated_at')).toContain(
      'updated_at.lt.2026-11-13T10:00:00Z,and(updated_at.eq.',
    );
  });
});
