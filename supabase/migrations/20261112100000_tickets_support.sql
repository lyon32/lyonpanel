-- Support : limite de 3 tickets non fermés et statut qui suit les messages.

create or replace function enforce_ticket_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ticket_limit:' || new.user_id::text, 0));
  if (select count(*) from tickets
      where user_id = new.user_id and status in ('open','answered')) >= 3 then
    raise exception 'TICKET_LIMIT_REACHED';
  end if;
  return new;
end $$;

create trigger tickets_limit_before_insert before insert on tickets
  for each row execute function enforce_ticket_limit();

create or replace function sync_ticket_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update tickets set
    status = case
      when not new.from_admin and status in ('answered','closed') then 'open'::ticket_status
      when new.from_admin and status = 'open' then 'answered'::ticket_status
      else status end,
    updated_at = now()
  where id = new.ticket_id;
  return null;
end $$;

create trigger ticket_messages_sync_after_insert after insert on ticket_messages
  for each row execute function sync_ticket_on_message();

revoke execute on function enforce_ticket_limit() from public, anon, authenticated;
revoke execute on function sync_ticket_on_message() from public, anon, authenticated;
