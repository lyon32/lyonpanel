-- Correctif : un CHECK évalué à NULL est accepté. Quand le réglage n'a jamais été posé,
-- current_setting(..., true) renvoie NULL et un solde négatif passait. On force un booléen strict.
alter table public.wallets drop constraint wallets_balance_xaf_check;
alter table public.wallets add constraint wallets_balance_xaf_check
  check (balance_xaf >= 0 or coalesce(current_setting('lyonpanel.allow_debt', true), '') = 'on');

alter table public.wallet_transactions drop constraint wallet_transactions_balance_after_xaf_check;
alter table public.wallet_transactions add constraint wallet_transactions_balance_after_xaf_check
  check (balance_after_xaf >= 0 or coalesce(ref like 'referral_cancel:%', false));
