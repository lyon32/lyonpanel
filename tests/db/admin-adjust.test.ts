import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];
let adminId = '';
let adminCreated = false;

beforeAll(async () => {
  // Un seul administrateur possible : réutiliser l'existant, sinon en créer un.
  const { data: existing } = await db.from('profiles').select('id').eq('is_admin', true);
  const first = existing?.[0];
  if (first) {
    adminId = first.id;
  } else {
    const u = await makeUser();
    created.push(u.id);
    await db.from('profiles').update({ is_admin: true }).eq('id', u.id);
    adminId = u.id;
    adminCreated = true;
  }
});

afterAll(async () => {
  if (adminCreated) await db.from('profiles').update({ is_admin: false }).eq('id', adminId);
  for (const id of created) await removeUser(id);
});

async function client(balance: number) {
  const u = await makeUser();
  created.push(u.id);
  const { error } = await db.from('wallets').update({ balance_xaf: balance }).eq('user_id', u.id);
  expect(error).toBeNull();
  return u;
}

async function wallet(userId: string) {
  const { data } = await db.from('wallets').select('*').eq('user_id', userId).single();
  return data!;
}

const adjust = (user: string, amount: number, note: string | null, by = adminId) =>
  db.rpc('admin_adjust', { p_user: user, p_amount: amount, p_note: note, p_admin: by });

describe('admin_adjust : ajustement manuel', () => {
  it('crédite un ajustement positif avec note, created_by et audit_log', async () => {
    const u = await client(100);
    const { error } = await adjust(u.id, 500, 'geste commercial');
    expect(error).toBeNull();
    expect((await wallet(u.id)).balance_xaf).toBe(600);
    const { data: t } = await db.from('wallet_transactions').select('*').eq('user_id', u.id);
    expect(t).toHaveLength(1);
    expect(t![0]).toMatchObject({
      type: 'adjustment',
      amount_xaf: 500,
      balance_after_xaf: 600,
      note: 'geste commercial',
      created_by: adminId,
    });
    expect(t![0].ref).toBeTruthy();
    const { data: a } = await db
      .from('audit_log')
      .select('*')
      .eq('target_id', u.id)
      .eq('actor_id', adminId);
    expect(a).toHaveLength(1);
    expect(a![0].action).toBeTruthy();
    expect(a![0].details).toMatchObject({ amount_xaf: 500, note: 'geste commercial' });
  });

  it('débite un ajustement négatif', async () => {
    const u = await client(1000);
    const { error } = await adjust(u.id, -400, 'correction');
    expect(error).toBeNull();
    expect((await wallet(u.id)).balance_xaf).toBe(600);
    const { data: t } = await db.from('wallet_transactions').select('*').eq('user_id', u.id);
    expect(t![0]).toMatchObject({ type: 'adjustment', amount_xaf: -400, balance_after_xaf: 600 });
  });

  it('autorise de ramener le solde exactement à 0', async () => {
    const u = await client(300);
    expect((await adjust(u.id, -300, 'remise à zéro')).error).toBeNull();
    expect((await wallet(u.id)).balance_xaf).toBe(0);
  });
});

describe('admin_adjust : refus sans aucun changement', () => {
  async function expectUntouched(userId: string, balance: number) {
    expect((await wallet(userId)).balance_xaf).toBe(balance);
    const { count } = await db
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    expect(count).toBe(0);
  }

  it('refuse INSUFFICIENT_BALANCE si le solde deviendrait négatif', async () => {
    const u = await client(100);
    const { error } = await adjust(u.id, -101, 'trop');
    expect(error?.message).toContain('INSUFFICIENT_BALANCE');
    await expectUntouched(u.id, 100);
  });

  it('refuse NOTE_REQUIRED si la note est vide', async () => {
    const u = await client(100);
    for (const note of ['', '   ', null]) {
      const { error } = await adjust(u.id, 50, note);
      expect(error?.message).toContain('NOTE_REQUIRED');
    }
    await expectUntouched(u.id, 100);
  });

  it('refuse un montant de 0', async () => {
    const u = await client(100);
    const { error } = await adjust(u.id, 0, 'rien');
    expect(error).not.toBeNull();
    expect(error?.code).not.toBe('PGRST202');
    await expectUntouched(u.id, 100);
  });

  it("refuse NOT_ADMIN si l'appelant n'est pas administrateur", async () => {
    const u = await client(100);
    const { error } = await adjust(u.id, 50, 'fraude', u.id);
    expect(error?.message).toContain('NOT_ADMIN');
    await expectUntouched(u.id, 100);
  });

  it('un client authentifié ne peut pas appeler admin_adjust (permission denied)', async () => {
    const u = await client(100);
    const c = await userClient(u.id);
    const { error } = await c.rpc('admin_adjust', {
      p_user: u.id,
      p_amount: 50,
      p_note: 'x',
      p_admin: adminId,
    });
    expect(error?.message).toMatch(/permission denied/i);
    await expectUntouched(u.id, 100);
  });
});
