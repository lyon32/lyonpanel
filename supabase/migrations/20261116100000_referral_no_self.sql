-- Interdit l'auto-parrainage : un client ne peut pas être son propre parrain.
alter table profiles
  add constraint profiles_no_self_referral
  check (referred_by is null or referred_by <> id);
