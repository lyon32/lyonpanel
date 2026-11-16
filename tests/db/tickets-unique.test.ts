import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import { adminClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];
afterAll(async () => {
  for (const id of created) await removeUser(id);
});

describe('ticket_attachments : chemin unique', () => {
  it('rattacher deux fois le même chemin échoue', async () => {
    const u = await makeUser();
    created.push(u.id);
    const t = await db
      .from('tickets')
      .insert({ user_id: u.id, subject: `sujet-${randomUUID()}` })
      .select()
      .single();
    expect(t.error).toBeNull();
    const m = await db
      .from('ticket_messages')
      .insert({ ticket_id: t.data!.id, body: 'Capture' })
      .select()
      .single();
    expect(m.error).toBeNull();
    const row = {
      message_id: m.data!.id,
      storage_path: `${u.id}/${randomUUID()}.png`,
      mime: 'image/png',
      size_bytes: 1000,
    };
    expect((await db.from('ticket_attachments').insert(row)).error).toBeNull();
    const second = await db.from('ticket_attachments').insert(row);
    expect(second.error?.code).toBe('23505');
  });
});
