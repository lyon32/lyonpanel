-- Fonctions réservées à l'administrateur et à la suppression de compte (DATA_MODEL §6).
-- Appelées uniquement par le serveur (service_role).

-- Remboursement : un seul par commande (même partiel), montant <= montant débité.
create function public.refund_order(p_order uuid, p_amount bigint, p_admin uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_debit bigint;
  v_balance bigint;
begin
  perform 1 from public.profiles where id = p_admin and is_admin;
  if not found then
    raise exception 'NOT_ADMIN';
  end if;

  -- Verrou de la commande d'abord : sérialise deux remboursements simultanés.
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'refunded'
     or exists (select 1 from public.wallet_transactions where ref = 'refund:' || p_order) then
    raise exception 'ALREADY_REFUNDED';
  end if;

  select -amount_xaf into v_debit from public.wallet_transactions
   where order_id = p_order and type = 'order';
  if p_amount is null or p_amount <= 0 or p_amount > coalesce(v_debit, v_order.charged_xaf) then
    raise exception 'AMOUNT_TOO_HIGH';
  end if;

  perform 1 from public.wallets where user_id = v_order.user_id for update;
  update public.wallets set balance_xaf = balance_xaf + p_amount
   where user_id = v_order.user_id returning balance_xaf into v_balance;

  update public.orders set status = 'refunded' where id = p_order returning * into v_order;

  insert into public.wallet_transactions
    (user_id, type, amount_xaf, balance_after_xaf, order_id, ref, created_by)
  values (v_order.user_id, 'refund', p_amount, v_balance, p_order, 'refund:' || p_order, p_admin);

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'refund_order', 'orders', p_order::text,
          jsonb_build_object('amount_xaf', p_amount, 'user_id', v_order.user_id));

  return v_order;
end $$;

-- Ajustement manuel du solde, note obligatoire, jamais sous zéro.
create function public.admin_adjust(p_user uuid, p_amount bigint, p_note text, p_admin uuid)
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
  if v_balance + p_amount < 0 then
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

-- Anonymisation (droit à l'effacement) : garde commandes, paiements, portefeuille.
create function public.anonymize_user(p_user uuid)
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

  update public.ticket_messages set body = null
   where ticket_id in (select id from public.tickets where user_id = p_user);
  delete from public.ticket_attachments
   where message_id in (select m.id from public.ticket_messages m
                          join public.tickets t on t.id = m.ticket_id where t.user_id = p_user);
  delete from public.favorites where user_id = p_user;

  -- Libère l'email et le téléphone de la connexion.
  delete from auth.identities where user_id = p_user;
  update auth.users
     set email = null, phone = null, raw_user_meta_data = '{}'::jsonb
   where id = p_user;

  insert into public.audit_log (action, target_table, target_id)
  values ('anonymize_user', 'profiles', p_user::text);
end $$;

revoke execute on function public.refund_order(uuid, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.admin_adjust(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke execute on function public.anonymize_user(uuid) from public, anon, authenticated;
grant execute on function public.refund_order(uuid, bigint, uuid) to service_role;
grant execute on function public.admin_adjust(uuid, bigint, text, uuid) to service_role;
grant execute on function public.anonymize_user(uuid) to service_role;
