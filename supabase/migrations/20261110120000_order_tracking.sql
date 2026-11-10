-- Phase 7 : clé d'idempotence unique par client, et marqueur d'alerte par commande.
alter table public.orders drop constraint orders_idem_key_key;
alter table public.orders add constraint orders_user_id_idem_key_key unique (user_id, idem_key);
alter table public.orders add column alerted_at timestamptz;
