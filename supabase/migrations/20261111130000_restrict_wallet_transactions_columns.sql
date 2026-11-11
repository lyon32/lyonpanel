-- Le client ne lit que les colonnes publiques du journal (jamais ref, note, created_by, payment_id).
-- La RLS (lignes du client seulement) reste en place ; service_role n'est pas touché.
revoke select on public.wallet_transactions from authenticated, anon;
grant select (id, user_id, type, amount_xaf, balance_after_xaf, order_id, created_at)
  on public.wallet_transactions to authenticated;
