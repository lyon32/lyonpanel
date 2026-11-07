-- Le client ne lit jamais le coût JAP, les erreurs internes ni les données brutes de paiement.
-- Les politiques de lignes (RLS) restent en place ; on remplace le droit de table par un droit par colonnes.
revoke select on public.orders, public.payments from authenticated;

grant select (id, short_id, user_id, service_id, link, quantity, comments, price_xaf_1000,
              discount_pct, charged_xaf, status, start_count, remains, created_at, updated_at)
  on public.orders to authenticated;

grant select (id, user_id, saspay_session_id, credited_xaf, fee_xaf, total_paid, pay_currency,
              status, saspay_network, created_at, succeeded_at)
  on public.payments to authenticated;
