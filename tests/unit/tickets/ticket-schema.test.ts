import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_BODY_LENGTH,
  TICKET_SUBJECTS,
  createTicketSchema,
  listTicketsQuerySchema,
  patchTicketSchema,
  ticketMessageSchema,
} from '@/server/schemas/ticket';

/*
 * Contrat attendu (src/server/schemas/ticket.ts), clés en snake_case comme l'API (API_SPEC §6.8) :
 *   TICKET_SUBJECTS = ['order','recharge','account','other'] ; MAX_BODY_LENGTH = 4000 ; MAX_ATTACHMENTS_PER_MESSAGE = 3
 *   createTicketSchema  {subject, order_id?: uuid, body, attachment_ids?: uuid[]}  (« order » exige order_id)
 *   ticketMessageSchema {body, attachment_ids?}
 *   patchTicketSchema   {status: 'closed'}  (le client ne peut que fermer)
 *   listTicketsQuerySchema {cursor?: string, limit?: 1..50 (défaut 20)}  (valeurs venues d'une URL : texte)
 */

const orderId = randomUUID();
const valid = { subject: 'other', body: 'Bonjour, ma recharge n’apparaît pas.' };
const ids = (n: number) => Array.from({ length: n }, () => randomUUID());

describe('createTicketSchema', () => {
  it('expose exactement les 4 sujets fixes', () => {
    expect([...TICKET_SUBJECTS]).toEqual(['order', 'recharge', 'account', 'other']);
  });

  it.each(['recharge', 'account', 'other'])('accepte le sujet %s sans commande', (subject) => {
    expect(createTicketSchema.safeParse({ ...valid, subject }).success).toBe(true);
  });

  it('refuse le sujet « order » sans order_id', () => {
    expect(createTicketSchema.safeParse({ ...valid, subject: 'order' }).success).toBe(false);
  });

  it('accepte le sujet « order » avec une commande (uuid)', () => {
    expect(
      createTicketSchema.safeParse({ ...valid, subject: 'order', order_id: orderId }).success,
    ).toBe(true);
  });

  it('refuse un order_id qui n’est pas un uuid', () => {
    expect(
      createTicketSchema.safeParse({ ...valid, subject: 'order', order_id: '12' }).success,
    ).toBe(false);
  });

  it.each(['Commande', 'refund', '', 'x'.repeat(121), 42, null])(
    'refuse le sujet libre ou inconnu %j',
    (subject) => {
      expect(createTicketSchema.safeParse({ ...valid, subject }).success).toBe(false);
    },
  );

  it('refuse un message vide ou fait seulement d’espaces', () => {
    expect(createTicketSchema.safeParse({ ...valid, body: '' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...valid, body: '   \n ' }).success).toBe(false);
  });

  it('accepte un message de 4 000 caractères et refuse 4 001', () => {
    expect(MAX_BODY_LENGTH).toBe(4000);
    expect(createTicketSchema.safeParse({ ...valid, body: 'a'.repeat(4000) }).success).toBe(true);
    expect(createTicketSchema.safeParse({ ...valid, body: 'a'.repeat(4001) }).success).toBe(false);
  });

  it('garde le texte brut tel quel (pas de HTML interprété ni retiré)', () => {
    const body = '<b>gras</b> & <script>alert(1)</script>';
    expect(createTicketSchema.parse({ ...valid, body }).body).toBe(body);
  });

  it('accepte jusqu’à 3 pièces jointes et refuse la 4e', () => {
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(3);
    expect(createTicketSchema.safeParse({ ...valid, attachment_ids: ids(3) }).success).toBe(true);
    expect(createTicketSchema.safeParse({ ...valid, attachment_ids: ids(4) }).success).toBe(false);
  });

  it('refuse une pièce jointe qui n’est pas un uuid et un doublon d’identifiant', () => {
    expect(createTicketSchema.safeParse({ ...valid, attachment_ids: ['abc'] }).success).toBe(false);
    const id = randomUUID();
    expect(createTicketSchema.safeParse({ ...valid, attachment_ids: [id, id] }).success).toBe(
      false,
    );
  });

  it('ignore les champs imposés par le navigateur (user_id, status, from_admin)', () => {
    const r = createTicketSchema.parse({
      ...valid,
      user_id: randomUUID(),
      status: 'answered',
      from_admin: true,
    });
    expect(Object.keys(r).sort()).toEqual(['body', 'subject']);
  });
});

describe('ticketMessageSchema', () => {
  it('accepte un message avec pièces jointes', () => {
    expect(ticketMessageSchema.safeParse({ body: 'Merci', attachment_ids: ids(1) }).success).toBe(
      true,
    );
  });

  it('refuse vide, trop long et plus de 3 images', () => {
    expect(ticketMessageSchema.safeParse({ body: '' }).success).toBe(false);
    expect(ticketMessageSchema.safeParse({ body: 'a'.repeat(4001) }).success).toBe(false);
    expect(ticketMessageSchema.safeParse({ body: 'ok', attachment_ids: ids(4) }).success).toBe(
      false,
    );
  });

  it('ignore from_admin envoyé par le navigateur', () => {
    expect(ticketMessageSchema.parse({ body: 'ok', from_admin: true })).not.toHaveProperty(
      'from_admin',
    );
  });
});

describe('patchTicketSchema', () => {
  it('accepte seulement status = closed', () => {
    expect(patchTicketSchema.safeParse({ status: 'closed' }).success).toBe(true);
    for (const status of ['open', 'answered', '', undefined]) {
      expect(patchTicketSchema.safeParse({ status }).success).toBe(false);
    }
  });
});

describe('listTicketsQuerySchema', () => {
  it('limite par défaut à 20, accepte 1 à 50 (texte d’URL), refuse le reste', () => {
    expect(listTicketsQuerySchema.parse({}).limit).toBe(20);
    expect(listTicketsQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    for (const limit of ['0', '51', '-1', 'abc', '1.5']) {
      expect(listTicketsQuerySchema.safeParse({ limit }).success).toBe(false);
    }
  });
});
