-- Phase 11 (Admin 1) : annulation de bonus, dette autorisée au seul cas du bonus annulé,
-- borne referral_pct, limite de messages de ticket, chemin strict des pièces jointes.

-- 1) Empreinte d'inscription (HMAC, jamais l'IP) : colonne cachée au client.
alter table public.profiles add column signup_ip_hash text;

-- Pas de droit de lecture accordé sur cette colonne : elle reste cachée au client (liste de colonnes de la phase 1).

-- 2) Annulation de bonus.
alter table public.referral_rewards
  add column cancelled_at timestamptz,
  add column cancel_reason text,
  add column cancelled_by uuid references public.profiles(id);

-- 3) Solde négatif : seulement par cancel_referral_bonus (drapeau local à la transaction)
--    et, dans le journal, seulement pour une ligne 'referral_cancel:%'.
alter table public.wallets drop constraint wallets_balance_xaf_check;
alter table public.wallets add constraint wallets_balance_xaf_check
  check (balance_xaf >= 0 or current_setting('lyonpanel.allow_debt', true) = 'on');

alter table public.wallet_transactions drop constraint wallet_transactions_balance_after_xaf_check;
alter table public.wallet_transactions add constraint wallet_transactions_balance_after_xaf_check
  check (balance_after_xaf >= 0 or ref like 'referral_cancel:%');

create function public.cancel_referral_bonus(p_reward uuid, p_reason text, p_admin uuid)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_reward public.referral_rewards;
  v_balance bigint;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform 1 from public.profiles where id = p_admin and is_admin;
  if not found then
    raise exception 'NOT_ADMIN';
  end if;
  if v_reason is null then
    raise exception 'NOTE_REQUIRED';
  end if;

  select * into v_reward from public.referral_rewards where id = p_reward for update;
  if not found then
    raise exception 'REWARD_NOT_FOUND';
  end if;
  if v_reward.cancelled_at is not null then
    raise exception 'ALREADY_CANCELLED';
  end if;

  perform 1 from public.wallets where user_id = v_reward.referrer_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  perform set_config('lyonpanel.allow_debt', 'on', true);
  update public.wallets set balance_xaf = balance_xaf - v_reward.amount_xaf
   where user_id = v_reward.referrer_id returning balance_xaf into v_balance;
  perform set_config('lyonpanel.allow_debt', 'off', true);

  insert into public.wallet_transactions
    (user_id, type, amount_xaf, balance_after_xaf, ref, note, created_by)
  values (v_reward.referrer_id, 'adjustment', -v_reward.amount_xaf, v_balance,
          'referral_cancel:' || v_reward.id, 'Bonus de parrainage annulé : ' || v_reason, p_admin);

  update public.referral_rewards
     set cancelled_at = now(), cancelled_by = p_admin, cancel_reason = v_reason
   where id = v_reward.id;

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'cancel_referral_bonus', 'referral_rewards', v_reward.id::text,
          jsonb_build_object('amount_xaf', v_reward.amount_xaf, 'referrer_id', v_reward.referrer_id,
                             'reason', v_reason, 'balance_after_xaf', v_balance));
  return v_balance;
end $$;

revoke execute on function public.cancel_referral_bonus(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_referral_bonus(uuid, text, uuid) to service_role;

-- 4) referral_pct : nombre entre 0 et 100.
alter table public.settings add constraint settings_referral_pct_range
  check (key <> 'referral_pct' or (
    case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric between 0 and 100 else false end));

-- 5) Trois messages client d'affilée au plus par ticket (depuis la dernière réponse du propriétaire).
create function public.enforce_ticket_message_limit()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_since timestamptz;
  v_count int;
begin
  if new.from_admin then
    return new;
  end if;
  perform 1 from public.tickets where id = new.ticket_id for update;
  select max(created_at) into v_since from public.ticket_messages
   where ticket_id = new.ticket_id and from_admin;
  select count(*) into v_count from public.ticket_messages
   where ticket_id = new.ticket_id and not from_admin
     and (v_since is null or created_at > v_since);
  if v_count >= 3 then
    raise exception 'MESSAGE_LIMIT_REACHED';
  end if;
  return new;
end $$;

create trigger ticket_messages_limit before insert on public.ticket_messages
  for each row execute function public.enforce_ticket_message_limit();

-- 6) Pièces jointes : chemin strict <uid>/<uuid>.(jpg|png|webp).
drop policy ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (
    (select public.caller_not_deleted())
    and storage_path ~ ('^' || (select auth.uid())::text
        || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
    and exists (
      select 1 from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
      where m.id = message_id and t.user_id = (select auth.uid()) and m.from_admin = false)
  );
