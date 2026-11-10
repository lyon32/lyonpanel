-- Phase 5 : limites de recharge (500 à 500 000 XAF) et frais SasPay par défaut.
insert into public.settings (key, value)
values ('min_recharge_xaf', '500'), ('max_recharge_xaf', '500000')
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.settings (key, value)
values ('saspay_fee_pct', '3')
on conflict (key) do nothing;
