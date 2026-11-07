-- Commande + débit atomiques (DATA_MODEL §6). Le prix est recalculé ici, jamais fourni par l'appelant.
create function public.place_order(
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

  if p_qty is null or p_qty < v_service.min_qty or p_qty > v_service.max_qty then
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
