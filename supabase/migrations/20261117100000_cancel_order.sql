-- Annulation d'une commande par le client (décision du propriétaire, 2026-11-17).
-- Le fournisseur confirme l'annulation, puis le serveur appelle cette fonction : remboursement
-- intégral du montant débité, une seule fois par commande. Seul cas de remboursement sans admin.

alter table public.orders add column cancel_requested_at timestamptz;

create function public.refund_canceled_order(p_order uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_debit bigint;
  v_balance bigint;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'refunded'
     or exists (select 1 from public.wallet_transactions where ref = 'refund:' || p_order) then
    raise exception 'ALREADY_REFUNDED';
  end if;

  -- Seule une commande dont le client a demandé l'annulation peut être remboursée ici.
  if v_order.cancel_requested_at is null or v_order.status not in ('in_progress', 'canceled') then
    raise exception 'NOT_CANCELLABLE';
  end if;

  select -amount_xaf into v_debit from public.wallet_transactions
   where order_id = p_order and type = 'order';
  v_debit := coalesce(v_debit, v_order.charged_xaf);

  perform 1 from public.wallets where user_id = v_order.user_id for update;
  update public.wallets set balance_xaf = balance_xaf + v_debit
   where user_id = v_order.user_id returning balance_xaf into v_balance;

  update public.orders set status = 'refunded' where id = p_order returning * into v_order;

  insert into public.wallet_transactions
    (user_id, type, amount_xaf, balance_after_xaf, order_id, ref, note)
  values (v_order.user_id, 'refund', v_debit, v_balance, p_order, 'refund:' || p_order,
          'cancel_by_client');

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (null, 'refund_canceled_order', 'orders', p_order::text,
          jsonb_build_object('amount_xaf', v_debit, 'user_id', v_order.user_id));

  return v_order;
end $$;

revoke execute on function public.refund_canceled_order(uuid) from public, anon, authenticated;
grant execute on function public.refund_canceled_order(uuid) to service_role;
