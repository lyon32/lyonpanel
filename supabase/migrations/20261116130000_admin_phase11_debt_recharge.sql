-- Phase 11 (faille « dette x recharge ») : un client en dette doit pouvoir recharger sans perdre son paiement.
-- Règle : le solde ne peut BAISSER sous zéro que via cancel_referral_bonus (drapeau lyonpanel.allow_debt).
-- Toute augmentation est acceptée, même si le solde reste négatif (-1000 + 500 = -500).

-- 1) wallets : le CHECK devient un déclencheur (un CHECK ne voit pas l'ancienne valeur).
alter table public.wallets drop constraint wallets_balance_xaf_check;

create function public.enforce_wallet_no_new_debt()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.balance_xaf < 0
     and (tg_op = 'INSERT' or new.balance_xaf < old.balance_xaf)
     and coalesce(current_setting('lyonpanel.allow_debt', true), '') <> 'on' then
    raise exception 'wallet balance cannot go below zero'
      using errcode = '23514', constraint = 'wallets_balance_xaf_check';
  end if;
  return new;
end $$;

create trigger wallets_no_new_debt before insert or update of balance_xaf on public.wallets
  for each row execute function public.enforce_wallet_no_new_debt();

-- 2) wallet_transactions : solde après négatif accepté pour une entrée d'argent ou l'annulation de bonus.
alter table public.wallet_transactions drop constraint wallet_transactions_balance_after_xaf_check;
alter table public.wallet_transactions add constraint wallet_transactions_balance_after_xaf_check
  check (balance_after_xaf >= 0 or amount_xaf > 0 or coalesce(ref like 'referral_cancel:%', false));

-- 3) admin_adjust : le contrôle de solde ne vaut que pour un retrait (un ajout sur une dette est permis).
create or replace function public.admin_adjust(p_user uuid, p_amount bigint, p_note text, p_admin uuid)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform 1 from public.profiles where id = p_admin and is_admin;
  if not found then
    raise exception 'NOT_ADMIN';
  end if;
  if v_note is null then
    raise exception 'NOTE_REQUIRED';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select balance_xaf into v_balance from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.wallets set balance_xaf = balance_xaf + p_amount
   where user_id = p_user returning balance_xaf into v_balance;

  insert into public.wallet_transactions
    (user_id, type, amount_xaf, balance_after_xaf, ref, note, created_by)
  values (p_user, 'adjustment', p_amount, v_balance, 'adjust:' || gen_random_uuid(), v_note, p_admin);

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'admin_adjust', 'wallets', p_user::text,
          jsonb_build_object('amount_xaf', p_amount, 'note', v_note));

  return v_balance;
end $$;

revoke execute on function public.admin_adjust(uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust(uuid, bigint, text, uuid) to service_role;
