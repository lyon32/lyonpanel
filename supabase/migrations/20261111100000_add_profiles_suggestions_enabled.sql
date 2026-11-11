-- Préférence client : afficher ou non les suggestions. Écrite par PATCH /me (client service).
-- profiles_update_own reste limitée à `language` : aucun accès client direct.
alter table public.profiles
  add column suggestions_enabled boolean not null default true;
