import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const orderRow = {
  id: 'o1',
  short_id: 'A1',
  service_id: 7,
  link: 'https://x.test',
  quantity: 100,
  charged_xaf: 500,
  status: 'completed',
  start_count: 0,
  remains: 0,
  created_at: '2026-11-18T10:00:00Z',
  updated_at: '2026-11-18T10:00:00Z',
};
const serviceRow = {
  id: 7,
  platform: 'tiktok',
  category: 'followers',
  name_fr: 'Followers TikTok',
  custom_name_fr: 'Nom perso FR',
  custom_name_en: 'Custom EN',
  refill: false,
  cancel: false,
  dripfeed: false,
  min_qty: 10,
  max_qty: 1000,
};

vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'or']) q[m] = () => q;
    q.limit = async () => ({ data: [orderRow], error: null });
    return { from: () => q };
  },
}));
vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ in: async () => ({ data: [serviceRow], error: null }) }) }),
  }),
}));

import { listOrders } from '@/server/orders/list-orders';

describe('listOrders : nom du service', () => {
  it('utilise le nom personnalisé de la langue demandée', async () => {
    const fr = await listOrders('u1', { limit: 10 }, 'fr');
    const en = await listOrders('u1', { limit: 10 }, 'en');
    expect(fr.data[0]?.service.name).toBe('Nom perso FR');
    expect(en.data[0]?.service.name).toBe('Custom EN');
  });
});
