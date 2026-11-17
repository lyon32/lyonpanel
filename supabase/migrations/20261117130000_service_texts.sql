-- Textes de service (phase 12, décision 2026-11-17).
-- description_* : générés par la synchro. custom_* : saisis par l'admin, jamais écrasés par la synchro.
alter table public.services
  add column description_fr text,
  add column description_en text,
  add column custom_name_fr text,
  add column custom_name_en text,
  add column custom_description_fr text,
  add column custom_description_en text;

create or replace view public.services_public with (security_invoker = false) as
  select id, platform, category, name_fr, price_xaf_1000, min_qty, max_qty,
         refill, cancel, dripfeed, sort_order, name_en,
         description_fr, description_en,
         custom_name_fr, custom_name_en, custom_description_fr, custom_description_en
  from public.services
  where active and available;
grant select on public.services_public to anon, authenticated;

-- Même fonction qu'avant, avec les quatre champs custom_* (vide -> null, 400 caractères max).
create or replace function public.update_service(p_service int, p_admin uuid, p_changes jsonb)
returns public.services
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.services%rowtype;
  v_new public.services%rowtype;
  v_changes jsonb := '{}'::jsonb;
  v_rate numeric;
  v_mult numeric;
  v_key text;
  v_txt text;
  v_old text;
begin
  perform public.assert_admin(p_admin);
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'EMPTY_CHANGES';
  end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key not in ('active', 'name_fr', 'name_en', 'sort_order', 'multiplier',
                     'custom_name_fr', 'custom_name_en', 'custom_description_fr', 'custom_description_en') then
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

  -- Textes personnalisés : null JSON ou texte vide -> null ; sinon texte (non-chaîne refusé).
  foreach v_key in array array['custom_name_fr', 'custom_name_en', 'custom_description_fr', 'custom_description_en'] loop
    if p_changes ? v_key then
      if jsonb_typeof(p_changes->v_key) = 'null' then
        v_txt := null;
      elsif jsonb_typeof(p_changes->v_key) = 'string' then
        v_txt := nullif(btrim(p_changes->>v_key), '');
      else
        raise exception 'INVALID_FIELD';
      end if;
      if char_length(coalesce(v_txt, '')) > 400 then raise exception 'INVALID_FIELD'; end if;
      case v_key
        when 'custom_name_fr' then v_old := v_s.custom_name_fr; v_new.custom_name_fr := v_txt;
        when 'custom_name_en' then v_old := v_s.custom_name_en; v_new.custom_name_en := v_txt;
        when 'custom_description_fr' then v_old := v_s.custom_description_fr; v_new.custom_description_fr := v_txt;
        else v_old := v_s.custom_description_en; v_new.custom_description_en := v_txt;
      end case;
      if v_txt is distinct from v_old then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old, 'new', v_txt));
      end if;
    end if;
  end loop;

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
         price_xaf_1000 = v_new.price_xaf_1000,
         custom_name_fr = v_new.custom_name_fr, custom_name_en = v_new.custom_name_en,
         custom_description_fr = v_new.custom_description_fr,
         custom_description_en = v_new.custom_description_en
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
