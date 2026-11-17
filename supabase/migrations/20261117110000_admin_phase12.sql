-- Phase 12 (Admin 2) : remboursements cumulés, actions admin sur les commandes, services, réglages,
-- tickets. Chaque changement admin et sa trace audit_log passent dans UNE fonction (une transaction) :
-- si la trace échoue, rien n'est enregistré. Toutes réservées au service_role.
-- Déjà en base, rien à refaire : journal non modifiable (audit_log_immutable), un seul admin
-- (profiles_single_admin), état 'pending' dans l'enum order_status.

-- ========== Colonnes ==========
alter table public.services add column name_en text;
-- Marqueur du renvoi manuel : un seul renvoi par commande, jamais effacé.
alter table public.orders add column resent_at timestamptz;
-- Réservation courte de l'annulation admin : un double clic n'envoie qu'une annulation au fournisseur.
alter table public.orders add column cancel_claimed_at timestamptz;

create or replace view public.services_public with (security_invoker = false) as
  select id, platform, category, name_fr, price_xaf_1000, min_qty, max_qty,
         refill, cancel, dripfeed, sort_order, name_en
  from public.services
  where active and available;
grant select on public.services_public to anon, authenticated;

create index audit_log_action_idx on public.audit_log (action, id desc);

-- ========== Garde commune ==========
create function public.assert_admin(p_admin uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = p_admin and is_admin;
  if not found then
    raise exception 'NOT_ADMIN';
  end if;
end $$;

-- ========== Remboursement (remplace la version de la phase 0) ==========
drop function public.refund_order(uuid, bigint, uuid);

-- Plafond = part non livrée floor(charged * remains / quantity) (remains null : prix payé), moins ce
-- qui est déjà rendu. Plusieurs partiels possibles ; la commande passe 'refunded' au plafond atteint.
-- Seule écriture de solde de ce fichier : crédit du portefeuille + ligne d'historique + trace.
create function public.refund_order(
  p_order uuid, p_amount bigint, p_admin uuid, p_reason text, p_idem_key text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_cap bigint;
  v_done bigint;
  v_balance bigint;
  v_ref text;
  v_key text := nullif(btrim(coalesce(p_idem_key, '')), '');
begin
  perform public.assert_admin(p_admin);
  if v_reason is null then
    raise exception 'REASON_REQUIRED';
  end if;

  -- Verrou de la commande : sérialise les remboursements simultanés.
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Rejeu de la même clé : déjà fait, aucun second crédit.
  if v_key is not null then
    v_ref := 'refund:' || p_order || ':k:' || v_key;
    if exists (select 1 from public.wallet_transactions where ref = v_ref) then
      return v_order;
    end if;
  else
    v_ref := 'refund:' || p_order || ':' || gen_random_uuid();
  end if;

  if v_order.status = 'refunded' then
    raise exception 'ALREADY_REFUNDED';
  end if;
  if v_order.status <> 'to_review' then
    raise exception 'ORDER_NOT_REFUNDABLE';
  end if;

  v_cap := case
    when v_order.remains is null then v_order.charged_xaf
    else least(v_order.charged_xaf,
               floor(v_order.charged_xaf::numeric * greatest(v_order.remains, 0) / v_order.quantity)::bigint)
  end;
  select coalesce(sum(amount_xaf), 0) into v_done from public.wallet_transactions
   where order_id = p_order and type = 'refund';

  if p_amount is null or p_amount <= 0 or p_amount > v_cap - v_done then
    raise exception 'AMOUNT_TOO_HIGH';
  end if;

  perform 1 from public.wallets where user_id = v_order.user_id for update;
  update public.wallets set balance_xaf = balance_xaf + p_amount
   where user_id = v_order.user_id returning balance_xaf into v_balance;

  if v_done + p_amount >= v_cap then
    update public.orders set status = 'refunded' where id = p_order returning * into v_order;
  end if;

  insert into public.wallet_transactions
    (user_id, type, amount_xaf, balance_after_xaf, order_id, ref, note, created_by)
  values (v_order.user_id, 'refund', p_amount, v_balance, p_order, v_ref, 'refund_by_admin', p_admin);

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'refund_order', 'orders', p_order::text,
          jsonb_build_object('amount_xaf', p_amount, 'reason', v_reason,
                             'total_refunded_xaf', v_done + p_amount, 'cap_xaf', v_cap,
                             'user_id', v_order.user_id));
  return v_order;
end $$;

-- ========== Actions sur une commande ==========
-- Annulation d'une commande en cours (admin). Deux temps : réserver (avant l'appel au fournisseur,
-- pour qu'un double clic n'envoie qu'une annulation), puis cancel_order après sa confirmation.
-- Ne pose PAS cancel_requested_at : la synchro ne rembourse donc jamais seule.
create function public.claim_order_cancel(p_order uuid, p_admin uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_admin(p_admin);
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('pending', 'in_progress') then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
  if v_order.cancel_claimed_at is not null and v_order.cancel_claimed_at > now() - interval '2 minutes' then
    raise exception 'ACTION_IN_PROGRESS';
  end if;
  update public.orders set cancel_claimed_at = now() where id = p_order returning * into v_order;
  return v_order;
end $$;

-- Le fournisseur a refusé ou est en panne : on libère la réservation.
create function public.release_order_cancel(p_order uuid, p_admin uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin(p_admin);
  update public.orders set cancel_claimed_at = null where id = p_order;
end $$;

create function public.cancel_order(p_order uuid, p_admin uuid, p_reason text)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.assert_admin(p_admin);
  if v_reason is null then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('pending', 'in_progress') then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
  update public.orders set status = 'to_review', cancel_claimed_at = null
   where id = p_order returning * into v_order;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'cancel_order', 'orders', p_order::text, jsonb_build_object('reason', v_reason));
  return v_order;
end $$;

-- Renvoi manuel : une seule fois par commande. On réserve (resent_at) AVANT d'appeler provider.add :
-- un double clic ou un échec du fournisseur ne permet jamais un deuxième envoi.
create function public.claim_order_resend(p_order uuid, p_admin uuid, p_reason text)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
begin
  perform public.assert_admin(p_admin);
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.resent_at is not null then
    raise exception 'ALREADY_RESENT';
  end if;
  -- Déjà remboursée (même en partie) : renvoyer servirait le client deux fois.
  if v_order.status <> 'to_review'
     or exists (select 1 from public.wallet_transactions where order_id = p_order and type = 'refund') then
    raise exception 'ORDER_NOT_RESENDABLE';
  end if;
  update public.orders set resent_at = now() where id = p_order returning * into v_order;
  return v_order;
end $$;

-- Après le succès de provider.add : nouvelle référence, retour en cours, trace.
create function public.resend_order(
  p_order uuid, p_admin uuid, p_reason text, p_provider_order_id bigint)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old bigint;
begin
  perform public.assert_admin(p_admin);
  if v_reason is null then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.resent_at is null or v_order.status <> 'to_review' then
    raise exception 'ORDER_NOT_RESENDABLE';
  end if;
  v_old := v_order.provider_order_id;
  update public.orders set provider_order_id = p_provider_order_id, status = 'in_progress',
         error = null
   where id = p_order returning * into v_order;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'resend_order', 'orders', p_order::text,
          jsonb_build_object('reason', v_reason, 'old_provider_order_id', v_old,
                             'new_provider_order_id', p_provider_order_id));
  return v_order;
end $$;

-- Clôture : to_review -> completed, sans mouvement d'argent.
create function public.close_order(p_order uuid, p_admin uuid, p_reason text)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.assert_admin(p_admin);
  if v_reason is null then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'to_review' then
    raise exception 'ORDER_NOT_CLOSABLE';
  end if;
  update public.orders set status = 'completed' where id = p_order returning * into v_order;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'close_order', 'orders', p_order::text, jsonb_build_object('reason', v_reason));
  return v_order;
end $$;

-- ========== Services ==========
-- p_changes : active, name_fr, name_en, sort_order, multiplier (autres clés refusées).
-- Le prix est recalculé ici : ceil(coût × taux × multiplicateur / 5) × 5, minimum 5 (comme le serveur).
create function public.update_service(p_service int, p_admin uuid, p_changes jsonb)
returns public.services
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.services%rowtype;
  v_new public.services%rowtype;
  v_changes jsonb := '{}'::jsonb;
  v_rate numeric;
  v_mult numeric;
  v_key text;
begin
  perform public.assert_admin(p_admin);
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'EMPTY_CHANGES';
  end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key not in ('active', 'name_fr', 'name_en', 'sort_order', 'multiplier') then
      raise exception 'INVALID_FIELD';
    end if;
  end loop;

  select * into v_s from public.services where id = p_service for update;
  if not found then
    raise exception 'SERVICE_NOT_FOUND';
  end if;
  v_new := v_s;

  if p_changes ? 'active' then
    if jsonb_typeof(p_changes->'active') <> 'boolean' then raise exception 'INVALID_FIELD'; end if;
    v_new.active := (p_changes->>'active')::boolean;
  end if;
  if p_changes ? 'name_fr' then
    v_new.name_fr := nullif(btrim(p_changes->>'name_fr'), '');
    if v_new.name_fr is null then raise exception 'INVALID_FIELD'; end if;
  end if;
  if p_changes ? 'name_en' then
    v_new.name_en := nullif(btrim(p_changes->>'name_en'), '');
  end if;
  if p_changes ? 'sort_order' then
    if jsonb_typeof(p_changes->'sort_order') <> 'number' then raise exception 'INVALID_FIELD'; end if;
    v_new.sort_order := (p_changes->>'sort_order')::int;
  end if;
  if p_changes ? 'multiplier' then
    if jsonb_typeof(p_changes->'multiplier') <> 'number' then raise exception 'INVALID_FIELD'; end if;
    v_mult := (p_changes->>'multiplier')::numeric;
    if v_mult <= 0 or v_mult > 50 then raise exception 'INVALID_FIELD'; end if;
    v_new.multiplier := v_mult;
    select (value #>> '{}')::numeric into v_rate from public.settings where key = 'usd_xaf_rate';
    if v_s.cost_usd_1000 is null or v_rate is null then
      raise exception 'INVALID_FIELD';
    end if;
    v_new.price_xaf_1000 :=
      greatest(5, (ceil(v_s.cost_usd_1000 * v_rate * v_mult / 5) * 5)::bigint);
  end if;

  if v_new.active is distinct from v_s.active then
    v_changes := v_changes || jsonb_build_object('active', jsonb_build_object('old', v_s.active, 'new', v_new.active));
  end if;
  if v_new.name_fr is distinct from v_s.name_fr then
    v_changes := v_changes || jsonb_build_object('name_fr', jsonb_build_object('old', v_s.name_fr, 'new', v_new.name_fr));
  end if;
  if v_new.name_en is distinct from v_s.name_en then
    v_changes := v_changes || jsonb_build_object('name_en', jsonb_build_object('old', v_s.name_en, 'new', v_new.name_en));
  end if;
  if v_new.sort_order is distinct from v_s.sort_order then
    v_changes := v_changes || jsonb_build_object('sort_order', jsonb_build_object('old', v_s.sort_order, 'new', v_new.sort_order));
  end if;
  if v_new.multiplier is distinct from v_s.multiplier then
    v_changes := v_changes
      || jsonb_build_object('multiplier', jsonb_build_object('old', v_s.multiplier, 'new', v_new.multiplier))
      || jsonb_build_object('price_xaf_1000', jsonb_build_object('old', v_s.price_xaf_1000, 'new', v_new.price_xaf_1000));
  end if;

  if v_changes = '{}'::jsonb then
    return v_s;
  end if;

  update public.services
     set active = v_new.active, name_fr = v_new.name_fr, name_en = v_new.name_en,
         sort_order = v_new.sort_order, multiplier = v_new.multiplier,
         price_xaf_1000 = v_new.price_xaf_1000
   where id = p_service returning * into v_new;

  if v_changes ? 'price_xaf_1000' then
    insert into public.service_price_history
      (service_id, cost_usd_1000, price_xaf_1000, multiplier, usd_xaf_rate, reason)
    values (p_service, v_new.cost_usd_1000, v_new.price_xaf_1000, v_new.multiplier, v_rate, 'admin_multiplier');
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'update_service', 'services', p_service::text,
          jsonb_build_object('changes', v_changes));
  return v_new;
end $$;

-- ========== Réglages ==========
-- p_changes : { clé: valeur, ... } ; clés connues seulement, valeurs bornées ; une trace par clé
-- (ancienne et nouvelle valeur). Tout ou rien.
create function public.update_setting(p_changes jsonb, p_admin uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_val jsonb;
  v_old jsonb;
  v_num numeric;
  v_min numeric;
  v_max numeric;
begin
  perform public.assert_admin(p_admin);
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'EMPTY_CHANGES';
  end if;

  for v_key, v_val in select * from jsonb_each(p_changes) loop
    v_num := case when jsonb_typeof(v_val) = 'number' then (v_val #>> '{}')::numeric end;
    case v_key
      when 'usd_xaf_rate' then
        if v_num is null or v_num <= 0 or v_num > 100000 then raise exception 'INVALID_SETTING'; end if;
      when 'default_multiplier' then
        if v_num is null or v_num <= 0 or v_num > 50 then raise exception 'INVALID_SETTING'; end if;
      when 'min_recharge_xaf', 'max_recharge_xaf', 'daily_order_cap_xaf' then
        if v_num is null or v_num <> trunc(v_num) or v_num < 1 or v_num > 100000000 then
          raise exception 'INVALID_SETTING';
        end if;
      when 'provider_low_balance_usd' then
        if v_num is null or v_num < 0 or v_num > 100000 then raise exception 'INVALID_SETTING'; end if;
      when 'price_alert_pct' then
        if v_num is null or v_num <= 0 or v_num > 1000 then raise exception 'INVALID_SETTING'; end if;
      when 'referral_pct' then
        if v_num is null or v_num < 0 or v_num > 100 then raise exception 'INVALID_SETTING'; end if;
      when 'auto_discount' then
        if jsonb_typeof(v_val) <> 'object'
           or (select count(*) from jsonb_object_keys(v_val)) <> 2
           or jsonb_typeof(v_val->'threshold_xaf') is distinct from 'number'
           or jsonb_typeof(v_val->'pct') is distinct from 'number'
           or (v_val->>'threshold_xaf')::numeric < 0
           or (v_val->>'threshold_xaf')::numeric <> trunc((v_val->>'threshold_xaf')::numeric)
           or (v_val->>'pct')::numeric < 0 or (v_val->>'pct')::numeric > 100 then
          raise exception 'INVALID_SETTING';
        end if;
      else
        raise exception 'UNKNOWN_SETTING';
    end case;

    select value into v_old from public.settings where key = v_key for update;
    if v_old is distinct from v_val then
      insert into public.settings (key, value) values (v_key, v_val)
        on conflict (key) do update set value = excluded.value, updated_at = now();
      insert into public.audit_log (actor_id, action, target_table, target_id, details)
      values (p_admin, 'update_setting', 'settings', v_key,
              jsonb_build_object('old', v_old, 'new', v_val));
    end if;
  end loop;

  select (value #>> '{}')::numeric into v_min from public.settings where key = 'min_recharge_xaf';
  select (value #>> '{}')::numeric into v_max from public.settings where key = 'max_recharge_xaf';
  if v_min is not null and v_max is not null and v_min > v_max then
    raise exception 'INVALID_SETTING';
  end if;

  return (select jsonb_object_agg(key, value) from public.settings);
end $$;

-- ========== Tickets ==========
create function public.reply_ticket(p_ticket uuid, p_body text, p_admin uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_msg uuid;
begin
  perform public.assert_admin(p_admin);
  if v_body is null or length(v_body) > 5000 then
    raise exception 'INVALID_BODY';
  end if;
  perform 1 from public.tickets where id = p_ticket for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  insert into public.ticket_messages (ticket_id, from_admin, body)
  values (p_ticket, true, v_body) returning id into v_msg;
  update public.tickets set status = 'answered' where id = p_ticket;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'reply_ticket', 'tickets', p_ticket::text, jsonb_build_object('message_id', v_msg));
  return v_msg;
end $$;

-- Fermer ou rouvrir seulement ('answered' vient d'une réponse, pas d'un réglage manuel).
create function public.update_ticket(p_ticket uuid, p_status text, p_admin uuid)
returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.tickets%rowtype;
  v_old public.ticket_status;
begin
  perform public.assert_admin(p_admin);
  if p_status is null or p_status not in ('open', 'closed') then
    raise exception 'INVALID_STATUS';
  end if;
  select * into v_t from public.tickets where id = p_ticket for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  v_old := v_t.status;
  if v_old::text = p_status then
    return v_t;
  end if;
  update public.tickets set status = p_status::public.ticket_status
   where id = p_ticket returning * into v_t;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'update_ticket', 'tickets', p_ticket::text,
          jsonb_build_object('old', v_old, 'new', p_status));
  return v_t;
end $$;

-- ========== Clients (reprise atomique de la phase 11) ==========
-- p_changes : status ('active'|'blocked'), blocked_reason (obligatoire pour bloquer),
-- custom_discount_pct (null ou 0-50), daily_spend_limit_xaf (entier >= 0). Jamais de solde.
create function public.update_user(p_user uuid, p_admin uuid, p_changes jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.profiles%rowtype;
  v_changes jsonb := '{}'::jsonb;
  v_status text;
  v_reason text;
  v_key text;
begin
  perform public.assert_admin(p_admin);
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'EMPTY_CHANGES';
  end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key not in ('status', 'blocked_reason', 'custom_discount_pct', 'daily_spend_limit_xaf') then
      raise exception 'INVALID_FIELD';
    end if;
  end loop;

  select * into v_target from public.profiles where id = p_user for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  if p_changes ? 'status' then
    v_status := p_changes->>'status';
    if v_status is null or v_status not in ('active', 'blocked') then
      raise exception 'INVALID_FIELD';
    end if;
    if v_target.status = 'deleted' or (v_status = 'blocked' and v_target.is_admin) then
      raise exception 'FORBIDDEN';
    end if;
    if v_status = 'blocked' then
      v_reason := nullif(btrim(coalesce(p_changes->>'blocked_reason', '')), '');
      if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
    end if;
    v_changes := jsonb_build_object('status', v_status, 'blocked_reason', v_reason);
    update public.profiles set status = v_status::public.user_status, blocked_reason = v_reason
     where id = p_user;
  elsif p_changes ? 'blocked_reason' then
    raise exception 'INVALID_FIELD';
  end if;

  if p_changes ? 'custom_discount_pct' then
    v_changes := v_changes || jsonb_build_object('custom_discount_pct', p_changes->'custom_discount_pct');
    update public.profiles set custom_discount_pct = (p_changes->>'custom_discount_pct')::numeric
     where id = p_user;
  end if;
  if p_changes ? 'daily_spend_limit_xaf' then
    v_changes := v_changes || jsonb_build_object('daily_spend_limit_xaf', p_changes->'daily_spend_limit_xaf');
    update public.profiles set daily_spend_limit_xaf = (p_changes->>'daily_spend_limit_xaf')::bigint
     where id = p_user;
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'update_user', 'profiles', p_user::text, v_changes);
end $$;

create function public.add_note(p_user uuid, p_admin uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_note uuid;
begin
  perform public.assert_admin(p_admin);
  if v_body is null or length(v_body) > 2000 then
    raise exception 'INVALID_BODY';
  end if;
  perform 1 from public.profiles where id = p_user;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  insert into public.admin_notes (user_id, body) values (p_user, v_body) returning id into v_note;
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values (p_admin, 'add_note', 'profiles', p_user::text, jsonb_build_object('note_id', v_note));
  return v_note;
end $$;

-- ========== Droits : service_role seulement ==========
revoke execute on function
  public.assert_admin(uuid),
  public.refund_order(uuid, bigint, uuid, text, text),
  public.claim_order_cancel(uuid, uuid),
  public.release_order_cancel(uuid, uuid),
  public.cancel_order(uuid, uuid, text),
  public.claim_order_resend(uuid, uuid, text),
  public.resend_order(uuid, uuid, text, bigint),
  public.close_order(uuid, uuid, text),
  public.update_service(int, uuid, jsonb),
  public.update_setting(jsonb, uuid),
  public.reply_ticket(uuid, text, uuid),
  public.update_ticket(uuid, text, uuid),
  public.update_user(uuid, uuid, jsonb),
  public.add_note(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.assert_admin(uuid),
  public.refund_order(uuid, bigint, uuid, text, text),
  public.claim_order_cancel(uuid, uuid),
  public.release_order_cancel(uuid, uuid),
  public.cancel_order(uuid, uuid, text),
  public.claim_order_resend(uuid, uuid, text),
  public.resend_order(uuid, uuid, text, bigint),
  public.close_order(uuid, uuid, text),
  public.update_service(int, uuid, jsonb),
  public.update_setting(jsonb, uuid),
  public.reply_ticket(uuid, text, uuid),
  public.update_ticket(uuid, text, uuid),
  public.update_user(uuid, uuid, jsonb),
  public.add_note(uuid, uuid, text)
  to service_role;
