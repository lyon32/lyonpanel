-- Durcissement du support (2e passage sécurité, failles A, C, D).

-- A : le client ne dépose plus rien en direct ; seul le serveur (clé service) écrit dans le bucket.
drop policy if exists ticket_attachments_upload on storage.objects;

-- D : lecture stricte <uid>/<uuid>.(jpg|png|webp) pour le client ; l'administrateur reste inchangé.
drop policy if exists ticket_attachments_read on storage.objects;
create policy ticket_attachments_read on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (
      public.is_admin()
      or (
        name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
        and split_part(name, '/', 1) = (select auth.uid())::text
      )
    )
  );

-- C : corps d'un message borné en base (null = message supprimé).
alter table public.ticket_messages
  add constraint ticket_messages_body_len check (body is null or char_length(body) <= 4000);
