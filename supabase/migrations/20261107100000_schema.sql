-- Schéma complet LyonPanel (DATA_MODEL.md §2 à §4). RLS activée partout ; politiques en tâche 1.6.

-- ========== Types ==========
create type user_status    as enum ('active','blocked','deleted');
create type payment_status as enum ('created','pending','succeeded','failed');
create type order_status   as enum ('pending','in_progress','completed','partial','canceled','to_review','refunded');
create type tx_type        as enum ('recharge','order','refund','referral_bonus','adjustment');
create type ticket_status  as enum ('open','answered','closed');
create type currency_code  as enum ('XAF','XOF','USD');

-- ========== Tables ==========
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  phone text unique check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  country char(2) not null,
  display_currency currency_code not null default 'XAF',
  language text not null default 'fr' check (language in ('fr','en')),
  status user_status not null default 'active',
  is_admin boolean not null default false,
  referral_code text not null unique check (char_length(referral_code) = 8),
  referred_by uuid references profiles(id),
  custom_discount_pct numeric(5,2) check (custom_discount_pct between 0 and 50),
  daily_spend_limit_xaf bigint not null default 500000 check (daily_spend_limit_xaf >= 0),
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index profiles_single_admin on profiles ((true)) where is_admin;
create index profiles_country_idx on profiles (country);
create index profiles_referred_by_idx on profiles (referred_by);

create table wallets (
  user_id uuid primary key references profiles(id) on delete cascade,
  balance_xaf bigint not null default 0 check (balance_xaf >= 0),
  total_recharged_xaf bigint not null default 0 check (total_recharged_xaf >= 0),
  updated_at timestamptz not null default now()
);

create table services (
  id int primary key,
  platform text not null,
  category text,
  name_fr text,
  jap_name text,
  jap_type text,
  cost_usd_1000 numeric(12,4),
  margin_pct numeric(6,2),
  price_xaf_1000 bigint,
  min_qty int check (min_qty > 0),
  max_qty int check (max_qty > 0),
  refill boolean not null default false,
  cancel boolean not null default false,
  dripfeed boolean not null default false,
  active boolean not null default false,
  available boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  check (min_qty <= max_qty)
);
create index services_platform_category_active_idx on services (platform, category, active);
create index services_active_available_idx on services (active, available);

create table service_price_history (
  id bigserial primary key,
  service_id int not null references services(id),
  cost_usd_1000 numeric(12,4),
  price_xaf_1000 bigint,
  margin_pct numeric(6,2),
  usd_xaf_rate numeric(10,2),
  reason text,
  changed_at timestamptz not null default now()
);
create index service_price_history_idx on service_price_history (service_id, changed_at desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  saspay_session_id text not null unique,
  saspay_transaction_id text unique,
  credited_xaf bigint not null check (credited_xaf > 0),
  fee_xaf bigint not null check (fee_xaf >= 0),
  total_paid bigint not null,
  pay_currency text not null,
  status payment_status not null default 'created',
  saspay_network text,
  idem_key text not null unique,
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  succeeded_at timestamptz
);
create index payments_pending_idx on payments (status, created_at) where status = 'pending';
create index payments_user_idx on payments (user_id, created_at desc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  short_id bigserial not null unique,
  user_id uuid not null references profiles(id),
  service_id int not null references services(id),
  link text not null,
  quantity int not null check (quantity > 0),
  comments text[],
  price_xaf_1000 bigint not null,
  discount_pct numeric(5,2) not null default 0,
  charged_xaf bigint not null check (charged_xaf > 0),
  cost_usd numeric(12,4),
  jap_order_id bigint unique,
  status order_status not null default 'pending',
  start_count int,
  remains int,
  idem_key text not null unique,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on orders (user_id, created_at desc);
create index orders_active_status_idx on orders (status) where status in ('pending','in_progress','to_review');

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type tx_type not null,
  amount_xaf bigint not null check (amount_xaf <> 0),
  balance_after_xaf bigint not null check (balance_after_xaf >= 0),
  payment_id uuid references payments(id),
  order_id uuid references orders(id),
  ref text not null unique,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_idx on wallet_transactions (user_id, created_at desc);

create table favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  service_id int not null references services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  order_id uuid references orders(id),
  subject text not null,
  status ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on tickets (status, updated_at desc);
create index tickets_user_idx on tickets (user_id);

create table ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  from_admin boolean not null default false,
  body text,
  created_at timestamptz not null default now()
);

create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references ticket_messages(id) on delete cascade,
  storage_path text not null,
  mime text not null check (mime in ('image/jpeg','image/png','image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 2097152),
  created_at timestamptz not null default now()
);

create table admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id),
  referee_id uuid not null unique references profiles(id),
  payment_id uuid not null references payments(id),
  amount_xaf bigint not null check (amount_xaf > 0),
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table login_attempts (
  id bigserial primary key,
  identifier_hash text not null,
  ip_hash text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_identifier_idx on login_attempts (identifier_hash, created_at);
create index login_attempts_ip_idx on login_attempts (ip_hash, created_at);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table allowed_signups (
  email text primary key,
  added_at timestamptz not null default now()
);

create table idempotency_keys (
  key uuid not null,
  user_id uuid not null,
  route text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);

create table jap_balance_snapshots (
  id bigserial primary key,
  balance_usd numeric(12,4) not null,
  reserved_usd numeric(12,4),
  taken_at timestamptz not null default now()
);

-- ========== Déclencheurs ==========
create function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger wallets_updated  before update on wallets  for each row execute function set_updated_at();
create trigger services_updated before update on services for each row execute function set_updated_at();
create trigger orders_updated   before update on orders   for each row execute function set_updated_at();
create trigger tickets_updated  before update on tickets  for each row execute function set_updated_at();

-- Journaux immuables (y compris pour service_role)
create function forbid_journal_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Journal immuable : % interdit sur %', tg_op, tg_table_name
    using errcode = '42501';
end $$;

create trigger wallet_transactions_immutable before update or delete on wallet_transactions
  for each row execute function forbid_journal_change();
create trigger wallet_transactions_no_truncate before truncate on wallet_transactions
  for each statement execute function forbid_journal_change();
create trigger audit_log_immutable before update or delete on audit_log
  for each row execute function forbid_journal_change();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function forbid_journal_change();

-- Création du profil et du portefeuille à l'inscription.
-- Seules country, language et referral sont lus dans les métadonnées.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_country text := upper(coalesce(v_meta ->> 'country', ''));
  v_lang text := coalesce(v_meta ->> 'language', '');
  v_phone text := nullif(new.phone, '');
  v_code text;
  v_referrer uuid;
begin
  if v_country !~ '^[A-Z]{2}$' then v_country := 'CM'; end if;
  if v_lang not in ('fr','en') then v_lang := 'fr'; end if;
  if v_phone is not null and left(v_phone, 1) <> '+' then v_phone := '+' || v_phone; end if;

  if nullif(v_meta ->> 'referral', '') is not null then
    select p.id into v_referrer from public.profiles p
      where p.referral_code = v_meta ->> 'referral';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;

  insert into public.profiles (id, email, phone, country, language, referral_code, referred_by)
  values (new.id, nullif(new.email, ''), v_phone, v_country, v_lang, v_code, v_referrer);
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function forbid_journal_change() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ========== RLS (politiques en 1.6) ==========
alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table payments enable row level security;
alter table orders enable row level security;
alter table services enable row level security;
alter table service_price_history enable row level security;
alter table favorites enable row level security;
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
alter table ticket_attachments enable row level security;
alter table admin_notes enable row level security;
alter table referral_rewards enable row level security;
alter table settings enable row level security;
alter table login_attempts enable row level security;
alter table rate_limits enable row level security;
alter table allowed_signups enable row level security;
alter table idempotency_keys enable row level security;
alter table audit_log enable row level security;
alter table jap_balance_snapshots enable row level security;

-- ========== Stockage ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-attachments', 'ticket-attachments', false, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
