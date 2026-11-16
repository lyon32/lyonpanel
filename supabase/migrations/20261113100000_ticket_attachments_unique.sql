-- Une même pièce jointe (chemin de stockage) ne peut être rattachée qu'une seule fois.
create unique index ticket_attachments_storage_path_key on public.ticket_attachments (storage_path);
