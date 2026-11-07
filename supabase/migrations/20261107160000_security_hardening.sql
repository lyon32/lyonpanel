-- Durcissement issu de l'audit sécurité : bornes de quantité, anonymisation, comptes supprimés, paiement échoué.

-- a) Bornes de quantité obligatoires (rattrapage sûr des lignes sans borne : service rendu indisponible).
update public.services set active = false, available = false
 where min_qty is null or max_qty is null;
update public.services
   set min_qty = coalesce(min_qty, 1),
       max_qty = coalesce(max_qty, greatest(coalesce(min_qty, 1), 1))
 where min_qty is null or max_qty is null;
alter table public.services alter column min_qty set not null, alter column max_qty set not null;

create or replace function public.place_order(
  p_user uuid,
  p_service int,
  p_link text,
  p_qty int,
  p_comments text[],
  p_idem_key text,
  p_expected_price_xaf_1000 bigint default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_profile public.profiles%rowtype;
  v_service public.services%rowtype;
  v_auto jsonb;
  v_discount numeric := 0;
  v_charged bigint;
  v_spent bigint;
  v_balance bigint;
begin
  -- 1. Verrou du portefeuille : sérialise toutes les commandes du client.
  select * into v_wallet from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'ACCOUNT_BLOCKED';
  end if;

  -- 2. Idempotence : même clé = même commande renvoyée, sans nouveau débit.
  select * into v_order from public.orders where idem_key = p_idem_key and user_id = p_user;
  if found then
    return v_order;
  end if;

  select * into v_profile from public.profiles where id = p_user;
  if not found or v_profile.status <> 'active' then
    raise exception 'ACCOUNT_BLOCKED';
  end if;

  select * into v_service from public.services where id = p_service;
  if not found or not v_service.active or not v_service.available
     or coalesce(v_service.price_xaf_1000, 0) <= 0 then
    raise exception 'SERVICE_UNAVAILABLE';
  end if;

  if p_qty is null or p_qty <= 0 or p_qty < v_service.min_qty or p_qty > v_service.max_qty then
    raise exception 'QUANTITY_OUT_OF_RANGE';
  end if;

  if p_expected_price_xaf_1000 is not null
     and p_expected_price_xaf_1000 <> v_service.price_xaf_1000 then
    raise exception 'PRICE_CHANGED';
  end if;

  -- 3. Remise : la plus grande des deux, jamais cumulées.
  select value into v_auto from public.settings where key = 'auto_discount';
  if v_auto is not null
     and v_wallet.total_recharged_xaf >= (v_auto ->> 'threshold_xaf')::bigint then
    v_discount := (v_auto ->> 'pct')::numeric;
  end if;
  v_discount := greatest(v_discount, coalesce(v_profile.custom_discount_pct, 0));

  -- Arrondi au XAF supérieur, en numérique exact (pas de flottant).
  v_charged := ceil(v_service.price_xaf_1000::numeric * p_qty * (100 - v_discount) / 100000)::bigint;
  if v_charged < 1 then
    v_charged := 1;
  end if;

  -- 4. Plafond sur 24 h glissantes.
  select coalesce(sum(charged_xaf), 0) into v_spent from public.orders
   where user_id = p_user and created_at > now() - interval '24 hours'
     and status not in ('refunded', 'canceled');
  if v_spent + v_charged > v_profile.daily_spend_limit_xaf then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  if v_wallet.balance_xaf < v_charged then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  -- 5. Débit, commande, journal.
  update public.wallets set balance_xaf = balance_xaf - v_charged
   where user_id = p_user returning balance_xaf into v_balance;

  insert into public.orders (user_id, service_id, link, quantity, comments, price_xaf_1000,
                             discount_pct, charged_xaf, cost_usd, idem_key)
  values (p_user, p_service, p_link, p_qty, p_comments, v_service.price_xaf_1000,
          v_discount, v_charged,
          round(coalesce(v_service.cost_usd_1000, 0) * p_qty / 1000, 4), p_idem_key)
  returning * into v_order;

  insert into public.wallet_transactions (user_id, type, amount_xaf, balance_after_xaf, order_id, ref)
  values (p_user, 'order', -v_charged, v_balance, v_order.id, 'order:' || v_order.id);

  return v_order;
end $$;

revoke execute on function public.place_order(uuid, int, text, int, text[], text, bigint)
  from public, anon, authenticated;
grant execute on function public.place_order(uuid, int, text, int, text[], text, bigint)
  to service_role;

-- b) Anonymisation : coupe aussi toute session, tout jeton, tout facteur MFA et le mot de passe.
create or replace function public.anonymize_user(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_status public.user_status;
begin
  select status into v_status from public.profiles where id = p_user for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_status = 'deleted' then
    return;
  end if;

  update public.profiles
     set email = null, phone = null, status = 'deleted', deleted_at = now()
   where id = p_user;

  update public.tickets set subject = '[supprimé]' where user_id = p_user;
  update public.ticket_messages set body = null
   where ticket_id in (select id from public.tickets where user_id = p_user);
  delete from public.ticket_attachments
   where message_id in (select m.id from public.ticket_messages m
                          join public.tickets t on t.id = m.ticket_id where t.user_id = p_user);
  delete from public.favorites where user_id = p_user;

  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
  delete from auth.mfa_factors where user_id = p_user;
  delete from auth.identities where user_id = p_user;
  update auth.users
     set email = null, phone = null, encrypted_password = null,
         raw_user_meta_data = '{}'::jsonb,
         raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'providers' - 'provider'
   where id = p_user;

  insert into public.audit_log (action, target_table, target_id)
  values ('anonymize_user', 'profiles', p_user::text);
end $$;

revoke execute on function public.anonymize_user(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_user(uuid) to service_role;

-- c) Un compte supprimé ne peut plus rien créer (un compte bloqué peut encore écrire au support).
create function public.caller_not_deleted() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status <> 'deleted');
$$;
revoke execute on function public.caller_not_deleted() from public, anon;
grant execute on function public.caller_not_deleted() to authenticated, service_role;

drop policy favorites_insert on public.favorites;
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.caller_not_deleted()));

drop policy tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select public.caller_not_deleted())
    and (order_id is null or exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())))
  );

drop policy ticket_messages_insert on public.ticket_messages;
create policy ticket_messages_insert on public.ticket_messages for insert to authenticated
  with check (
    from_admin = false and (select public.caller_not_deleted())
    and exists (select 1 from public.tickets t
                where t.id = ticket_id and t.user_id = (select auth.uid()))
  );

drop policy ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (
    (select public.caller_not_deleted())
    and storage_path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
      where m.id = message_id and t.user_id = (select auth.uid()) and m.from_admin = false)
  );

-- d) credit_payment : un paiement échoué n'est jamais crédité.
create or replace function public.credit_payment(
  p_payment_id uuid,
  p_saspay_transaction_id text,
  p_net_amount_xaf bigint,
  p_fee_xaf bigint,
  p_total_paid bigint,
  p_network text,
  p_raw jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments%rowtype;
  v_balance bigint;
  v_referrer uuid;
  v_status public.user_status;
  v_pct numeric;
  v_bonus bigint := 0;
  v_reward uuid;
  v_ref_balance bigint;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  -- Doublon : déjà crédité, on ne refait rien.
  if v_pay.status = 'succeeded' then
    select balance_xaf into v_balance from public.wallets where user_id = v_pay.user_id;
    return jsonb_build_object('credited', false, 'balance_xaf', v_balance, 'referral_bonus_xaf', 0);
  end if;

  if v_pay.status = 'failed' then
    raise exception 'PAYMENT_NOT_PAYABLE';
  end if;

  if p_net_amount_xaf is distinct from v_pay.credited_xaf then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  -- La contrainte unique sur saspay_transaction_id refuse un identifiant déjà pris.
  update public.payments
     set status = 'succeeded', succeeded_at = now(),
         saspay_transaction_id = p_saspay_transaction_id,
         fee_xaf = p_fee_xaf, total_paid = p_total_paid,
         saspay_network = p_network, raw_webhook = p_raw
   where id = v_pay.id;

  perform 1 from public.wallets where user_id = v_pay.user_id for update;
  update public.wallets
     set balance_xaf = balance_xaf + v_pay.credited_xaf,
         total_recharged_xaf = total_recharged_xaf + v_pay.credited_xaf
   where user_id = v_pay.user_id
   returning balance_xaf into v_balance;

  insert into public.wallet_transactions (user_id, type, amount_xaf, balance_after_xaf, payment_id, ref)
  values (v_pay.user_id, 'recharge', v_pay.credited_xaf, v_balance, v_pay.id, 'pay:' || v_pay.id);

  select referred_by, status into v_referrer, v_status
    from public.profiles where id = v_pay.user_id;

  if v_status = 'deleted' then
    insert into public.audit_log (action, target_table, target_id, details)
    values ('payment_on_deleted_account', 'payments', v_pay.id::text,
            jsonb_build_object('note', 'à rembourser', 'user_id', v_pay.user_id,
                               'credited_xaf', v_pay.credited_xaf));
  end if;

  -- Bonus parrain : seulement à la 1re recharge du filleul (referee_id unique).
  if v_referrer is not null then
    select coalesce((value #>> '{}')::numeric, 5) into v_pct
      from public.settings where key = 'referral_pct';
    v_pct := coalesce(v_pct, 5);
    v_bonus := floor(v_pay.credited_xaf * v_pct / 100)::bigint;
    if v_bonus > 0 then
      insert into public.referral_rewards (referrer_id, referee_id, payment_id, amount_xaf)
      values (v_referrer, v_pay.user_id, v_pay.id, v_bonus)
      on conflict (referee_id) do nothing
      returning id into v_reward;
      if v_reward is not null then
        perform 1 from public.wallets where user_id = v_referrer for update;
        update public.wallets set balance_xaf = balance_xaf + v_bonus
         where user_id = v_referrer returning balance_xaf into v_ref_balance;
        insert into public.wallet_transactions (user_id, type, amount_xaf, balance_after_xaf, payment_id, ref)
        values (v_referrer, 'referral_bonus', v_bonus, v_ref_balance, v_pay.id, 'ref:' || v_reward);
      else
        v_bonus := 0;
      end if;
    else
      v_bonus := 0;
    end if;
  end if;

  return jsonb_build_object('credited', true, 'balance_xaf', v_balance, 'referral_bonus_xaf', v_bonus);
end $$;

revoke execute on function public.credit_payment(uuid, text, bigint, bigint, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.credit_payment(uuid, text, bigint, bigint, bigint, text, jsonb)
  to service_role;
