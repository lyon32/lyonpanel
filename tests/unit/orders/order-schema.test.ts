import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { createOrderSchema, quoteOrderSchema } from '@/server/schemas/order';

/*
 * Signatures attendues, fichier src/server/schemas/order.ts (Zod, partagé avec le formulaire) :
 *   quoteOrderSchema  = { service_id: int > 0, quantity: int > 0 }
 *   createOrderSchema = { service_id: int > 0, link: string (rogné, 1..2048), quantity: int > 0,
 *                         comments?: string[] (chaque ligne non vide), expected_total_xaf: int > 0 }
 *   type CreateOrderInput = z.infer<typeof createOrderSchema>   (clés en snake_case, comme l'API)
 * Les montants sont des entiers XAF : décimal, texte, négatif, zéro = refusés.
 */

const valid = {
  service_id: 123,
  link: 'https://www.tiktok.com/@client',
  quantity: 1000,
  expected_total_xaf: 1155,
};

describe('createOrderSchema', () => {
  it('accepte une commande valide et rogne le lien', () => {
    const out = createOrderSchema.parse({ ...valid, link: '  https://www.tiktok.com/@client ' });
    expect(out).toEqual(valid);
  });

  it('accepte 1000 commentaires et une ligne de 500 caractères (limites incluses)', () => {
    const comments = [...Array.from({ length: 999 }, () => 'ok'), 'a'.repeat(500)];
    expect(createOrderSchema.parse({ ...valid, comments }).comments).toHaveLength(1000);
  });

  it('accepte des commentaires (liste de textes)', () => {
    const out = createOrderSchema.parse({ ...valid, comments: ['Super !', 'Bravo'] });
    expect(out.comments).toEqual(['Super !', 'Bravo']);
  });

  it.each([
    ['service_id absent', { service_id: undefined }],
    ['service_id décimal', { service_id: 1.5 }],
    ['service_id nul', { service_id: 0 }],
    ['quantité nulle', { quantity: 0 }],
    ['quantité négative', { quantity: -10 }],
    ['quantité décimale', { quantity: 10.5 }],
    ['quantité en texte', { quantity: '1000' }],
    ['total attendu absent', { expected_total_xaf: undefined }],
    ['total attendu décimal', { expected_total_xaf: 1155.5 }],
    ['total attendu négatif', { expected_total_xaf: -1 }],
    ['total attendu en texte', { expected_total_xaf: '1155' }],
    ['lien vide', { link: '' }],
    ['lien absent', { link: undefined }],
    ['commentaires pas une liste', { comments: 'un seul texte' }],
    ['commentaire vide', { comments: ['ok', ''] }],
    ['plus de 1000 commentaires', { comments: Array.from({ length: 1001 }, () => 'ok') }],
    ['ligne de commentaire de plus de 500 caractères', { comments: ['a'.repeat(501)] }],
  ])('refuse : %s', (_label, patch) => {
    expect(() => createOrderSchema.parse({ ...valid, ...patch })).toThrow(ZodError);
  });
});

describe('quoteOrderSchema', () => {
  it('accepte service_id et quantity, ignore le reste (le prix ne vient jamais du navigateur)', () => {
    const out = quoteOrderSchema.parse({ service_id: 5, quantity: 100, total_xaf: 1 });
    expect(out).toEqual({ service_id: 5, quantity: 100 });
  });

  it.each([{ service_id: 5 }, { quantity: 100 }, { service_id: 5, quantity: 0 }, {}])(
    'refuse %j',
    (input) => {
      expect(() => quoteOrderSchema.parse(input)).toThrow(ZodError);
    },
  );
});
