-- Phase 4 : fournisseur générique (jap_* -> provider_*) et prix = coût × multiplicateur.
-- Aucune fonction d'argent ne référence les colonnes renommées : leur logique est inchangée.

drop view public.services_public;

-- ========== Renommages ==========
alter table public.services rename column jap_name to provider_name;
alter table public.services rename column jap_type to provider_type;
alter table public.orders rename column jap_order_id to provider_order_id;
alter table public.jap_balance_snapshots rename to provider_balance_snapshots;
alter policy jap_balance_snapshots_admin_select on public.provider_balance_snapshots
  rename to provider_balance_snapshots_admin_select;

-- ========== Multiplicateurs ==========
alter table public.services drop column margin_pct;
alter table public.services add column multiplier numeric(8,2) check (multiplier > 0);
alter table public.services alter column active set default true;
alter table public.service_price_history drop column margin_pct;
alter table public.service_price_history add column multiplier numeric(8,2);

create table public.price_multipliers (
  platform text not null,
  category text not null,
  multiplier numeric(8,2) not null check (multiplier > 0),
  updated_at timestamptz not null default now(),
  primary key (platform, category)
);
alter table public.price_multipliers enable row level security;
revoke all on public.price_multipliers from anon, authenticated;
create trigger price_multipliers_updated before update on public.price_multipliers
  for each row execute function public.set_updated_at();

-- ========== Vue publique ==========
create view public.services_public with (security_invoker = false) as
  select id, platform, category, name_fr, price_xaf_1000, min_qty, max_qty,
         refill, cancel, dripfeed, sort_order
  from public.services
  where active and available;
grant select on public.services_public to anon, authenticated;

-- ========== Réglages ==========
delete from public.settings where key = 'margins';
update public.settings set key = 'provider_low_balance_usd' where key = 'jap_low_balance_usd';
insert into public.settings (key, value) values ('default_multiplier', '3')
  on conflict (key) do update set value = excluded.value, updated_at = now();
