-- Securite des lignes (DATA_MODEL §5), droits minimaux et vue publique des services.
-- Principe : tout est refuse a anon / authenticated, puis on accorde le strict necessaire.

-- ========== 1. Tout retirer, y compris pour les objets futurs ==========
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

-- ========== 2. Administrateur ==========
-- security definer + search_path vide : pas de recursion RLS sur profiles.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ========== 3. Droits (colonnes sensibles de profiles exclues) ==========
grant select (id, email, phone, country, display_currency, language, status, referral_code,
              referred_by, daily_spend_limit_xaf, created_at, updated_at, deleted_at)
  on public.profiles to authenticated;
grant update (language) on public.profiles to authenticated;

grant select on
  public.wallets, public.wallet_transactions, public.payments, public.orders,
  public.favorites, public.tickets, public.ticket_messages, public.ticket_attachments,
  public.services, public.service_price_history, public.admin_notes, public.referral_rewards,
  public.settings, public.audit_log, public.jap_balance_snapshots, public.login_attempts,
  public.rate_limits, public.allowed_signups, public.idempotency_keys
  to authenticated;

grant insert, delete on public.favorites to authenticated;
grant insert (user_id, order_id, subject) on public.tickets to authenticated;
grant insert (ticket_id, body, from_admin) on public.ticket_messages to authenticated;
grant insert (message_id, storage_path, mime, size_bytes) on public.ticket_attachments to authenticated;

-- ========== 4. Politiques : ses lignes ou administrateur ==========
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy wallets_select on public.wallets for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy wallet_transactions_select on public.wallet_transactions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy favorites_select on public.favorites for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy tickets_select on public.tickets for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy tickets_insert on public.tickets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (order_id is null or exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())))
  );

create policy ticket_messages_select on public.ticket_messages for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.tickets t where t.id = ticket_id and t.user_id = (select auth.uid())));
create policy ticket_messages_insert on public.ticket_messages for insert to authenticated
  with check (
    from_admin = false
    and exists (select 1 from public.tickets t
                where t.id = ticket_id and t.user_id = (select auth.uid()))
  );

create policy ticket_attachments_select on public.ticket_attachments for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
    where m.id = message_id and t.user_id = (select auth.uid())));
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (
    storage_path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
      where m.id = message_id and t.user_id = (select auth.uid()) and m.from_admin = false)
  );

-- Tables internes : administrateur seulement (lecture ; les ecritures passent par le serveur).
create policy services_admin_select on public.services for select to authenticated
  using (public.is_admin());
create policy service_price_history_admin_select on public.service_price_history for select to authenticated
  using (public.is_admin());
create policy admin_notes_admin_select on public.admin_notes for select to authenticated
  using (public.is_admin());
create policy referral_rewards_admin_select on public.referral_rewards for select to authenticated
  using (public.is_admin());
create policy settings_admin_select on public.settings for select to authenticated
  using (public.is_admin());
create policy audit_log_admin_select on public.audit_log for select to authenticated
  using (public.is_admin());
create policy jap_balance_snapshots_admin_select on public.jap_balance_snapshots for select to authenticated
  using (public.is_admin());
create policy login_attempts_admin_select on public.login_attempts for select to authenticated
  using (public.is_admin());
create policy rate_limits_admin_select on public.rate_limits for select to authenticated
  using (public.is_admin());
create policy allowed_signups_admin_select on public.allowed_signups for select to authenticated
  using (public.is_admin());
create policy idempotency_keys_admin_select on public.idempotency_keys for select to authenticated
  using (public.is_admin());

-- ========== 5. Vue publique des services ==========
-- Executee avec les droits du proprietaire (security_invoker = false) car services est
-- illisible pour le client. Elle ne projette ni jap_name, ni cost_usd_1000, ni margin_pct,
-- et filtre elle-meme actifs et disponibles.
create view public.services_public with (security_invoker = false) as
  select id, platform, category, name_fr, jap_type, price_xaf_1000, min_qty, max_qty,
         refill, cancel, dripfeed, sort_order
  from public.services
  where active and available;
grant select on public.services_public to anon, authenticated;

-- ========== 6. Storage : bucket ticket-attachments, chemin <user_id>/<fichier> ==========
create policy ticket_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy ticket_attachments_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-attachments'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
