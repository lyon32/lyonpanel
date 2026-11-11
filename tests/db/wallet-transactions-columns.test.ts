import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];
let a: Awaited<ReturnType<typeof userClient>>;
let aId = '';
let bId = '';

async function addTx(userId: string, ref: string) {
  const { error } = await db.from('wallet_transactions').insert({
    user_id: userId,
    type: 'adjustment',
    amount_xaf: 1000,
    balance_after_xaf: 1000,
    ref,
    note: 'note interne',
  });
  expect(error).toBeNull();
}

beforeAll(async () => {
  const ua = await makeUser();
  const ub = await makeUser();
  aId = ua.id;
  bId = ub.id;
  created.push(aId, bId);
  await addTx(aId, `cols-a-${aId}`);
  await addTx(bId, `cols-b-${bId}`);
  a = await userClient(aId);
});

afterAll(async () => {
  await db.from('wallet_transactions').delete().in('user_id', created);
  for (const id of created) await removeUser(id);
});

describe('wallet_transactions : colonnes lisibles par le client', () => {
  it('lit les colonnes publiques de ses lignes', async () => {
    const { data, error } = await a
      .from('wallet_transactions')
      .select('id, user_id, type, amount_xaf, balance_after_xaf, order_id, created_at')
      .eq('user_id', aId);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it('refuse select(*)', async () => {
    const { data, error } = await a.from('wallet_transactions').select('*');
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it.each(['ref', 'note', 'created_by', 'payment_id'])('refuse la colonne %s', async (col) => {
    const { data, error } = await a.from('wallet_transactions').select(col);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("ne voit pas les lignes d'un autre client", async () => {
    const { data, error } = await a
      .from('wallet_transactions')
      .select('user_id')
      .eq('user_id', bId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
