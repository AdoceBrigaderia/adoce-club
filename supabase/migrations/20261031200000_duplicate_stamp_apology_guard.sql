-- Somente auditoria. NAO reaplica o estorno e NAO altera cartoes ou premios.
-- A politica legada permite INSERT de auditoria por gerente. Estes marcadores
-- exclusivos do servidor nao podem ser forjados para suprimir a comunicacao.
create policy duplicate_stamp_apology_server_insert
  on public.audit_events as restrictive for insert to authenticated
  with check (action not in ('stamps.duplicate_apology_claimed', 'stamps.duplicate_apology_sent', 'stamps.duplicate_apology_failed'));
create policy duplicate_stamp_apology_server_update
  on public.audit_events as restrictive for update to authenticated
  using (action not in ('stamps.duplicate_apology_claimed', 'stamps.duplicate_apology_sent', 'stamps.duplicate_apology_failed'))
  with check (action not in ('stamps.duplicate_apology_claimed', 'stamps.duplicate_apology_sent', 'stamps.duplicate_apology_failed'));
create policy duplicate_stamp_apology_server_delete
  on public.audit_events as restrictive for delete to authenticated
  using (action not in ('stamps.duplicate_apology_claimed', 'stamps.duplicate_apology_sent', 'stamps.duplicate_apology_failed'));

create unique index duplicate_stamp_apology_claim_once
  on public.audit_events(entity_id)
  where action = 'stamps.duplicate_apology_claimed' and entity_type = 'loyalty_track';
create unique index duplicate_stamp_apology_sent_once
  on public.audit_events(entity_id)
  where action = 'stamps.duplicate_apology_sent' and entity_type = 'loyalty_track';

create or replace function public.server_claim_duplicate_stamp_apology(requested_track_id uuid, requested_actor_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff_members where user_id = requested_actor_id and active and role = 'owner') then
    raise exception 'owner_required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duplicate-stamp-apology:' || requested_track_id::text, 0));
  if not exists (select 1 from public.ledger_entries where track_id = requested_track_id and idempotency_key like 'dup-reversal:%') then
    raise exception 'incident_track_required';
  end if;
  if exists (select 1 from public.audit_events where entity_type = 'loyalty_track' and entity_id = requested_track_id::text
    and action in ('stamps.duplicate_apology_claimed', 'stamps.duplicate_apology_sent', 'stamps.duplicate_apology_failed')) then
    return false;
  end if;
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (requested_actor_id, 'stamps.duplicate_apology_claimed', 'loyalty_track', requested_track_id::text,
      '{"incident":"duplicate-stamps-2026-10","automatic_retry":false}'::jsonb);
  return true;
end;
$$;
revoke all on function public.server_claim_duplicate_stamp_apology(uuid,uuid) from public, anon, authenticated;
grant execute on function public.server_claim_duplicate_stamp_apology(uuid,uuid) to service_role;
