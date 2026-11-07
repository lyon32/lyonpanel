-- Un compte supprimé ne lit plus rien, même avec un ancien jeton d'accès encore valide.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((id = (select auth.uid()) and status <> 'deleted') or public.is_admin());

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and status <> 'deleted')
  with check (id = (select auth.uid()) and status <> 'deleted');
