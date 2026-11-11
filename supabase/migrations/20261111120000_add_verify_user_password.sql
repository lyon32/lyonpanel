-- Vérifie le mot de passe d'un compte côté serveur (suppression de compte).
-- Appelable uniquement avec la clé service_role. Ne journalise rien.
create or replace function public.verify_user_password(p_user uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if p_user is null or p_password is null or p_password = '' then
    return false;
  end if;
  select encrypted_password into v_hash
    from auth.users
   where id = p_user and deleted_at is null;
  if v_hash is null or v_hash = '' then
    return false;
  end if;
  return extensions.crypt(p_password, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_user_password(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_user_password(uuid, text) to service_role;
