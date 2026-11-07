-- Crédit d'une recharge SasPay : une seule fois, atomique (DATA_MODEL §6).
-- Verrous dans l'ordre : paiement, puis portefeuille du client, puis portefeuille du parrain.
create function public.credit_payment(
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
