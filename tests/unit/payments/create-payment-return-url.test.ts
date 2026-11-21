import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => ({ returnUrl: '' }));
vi.mock('@/server/payments/quote', () => ({
  quotePayment: async (a: number) => ({ amountXaf: a, feeXaf: 0, totalToPay: a }),
}));
vi.mock('@/server/env', () => ({
  loadServerEnv: () => ({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined }),
}));
vi.mock('@/server/providers/saspay-client', () => ({
  getSaspay: () => ({
    createCheckoutSession: async (p: { returnUrl: string }) => {
      h.returnUrl = p.returnUrl;
      return { sessionId: 's1', checkoutUrl: 'https://pay.test/c' };
    },
  }),
}));
vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'update', 'insert', 'from']) q[m] = () => q;
    q.maybeSingle = async () => ({
      data: { email: 'a@b.c', phone: null, country: 'CM', language: 'fr', status: 'active' },
      error: null,
    });
    q.then = (ok: (v: unknown) => unknown) => ok({ data: null, error: null });
    return q;
  },
}));

const original = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("URL de retour d'une recharge", () => {
  it("lit NEXT_PUBLIC_SITE_URL au moment de l'appel, pas à l'import", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { createPayment } = await import('@/server/payments/create-payment');
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lyonpanel.vercel.app';
    await createPayment('u1', 3000, 'k1');
    expect(h.returnUrl).toMatch(/^https:\/\/lyonpanel\.vercel\.app\/fr\/recharger\//);
  });

  it("retombe sur l'adresse par défaut si la variable est absente", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { createPayment } = await import('@/server/payments/create-payment');
    await createPayment('u1', 3000, 'k2');
    expect(h.returnUrl).toMatch(/^https:\/\/lyonpanel\.com\/fr\/recharger\//);
  });
});
