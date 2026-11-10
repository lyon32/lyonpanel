import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createPaymentSchema } from '@/server/schemas/payment';

// Module attendu : src/server/schemas/payment.ts
//   createPaymentSchema = z.object({ amount_xaf: entier positif }) ; les champs inconnus sont retirés.
//   Les bornes min/max viennent des réglages (quote.ts), pas du schéma.

describe('createPaymentSchema', () => {
  it('accepte un montant entier', () => {
    expect(createPaymentSchema.parse({ amount_xaf: 3000 })).toEqual({ amount_xaf: 3000 });
  });

  it.each([0, -500, 3000.5, Number.NaN, Infinity])('refuse le montant %s', (amount) => {
    expect(createPaymentSchema.safeParse({ amount_xaf: amount }).success).toBe(false);
  });

  it('refuse un montant envoyé en texte', () => {
    expect(createPaymentSchema.safeParse({ amount_xaf: '3000' }).success).toBe(false);
  });

  it('refuse un montant absent', () => {
    expect(createPaymentSchema.safeParse({}).success).toBe(false);
  });

  it('retire les frais ou le total envoyés par le navigateur', () => {
    const parsed = createPaymentSchema.parse({ amount_xaf: 3000, fee_xaf: 0, total_to_pay: 1 });
    expect(parsed).toEqual({ amount_xaf: 3000 });
  });
});
