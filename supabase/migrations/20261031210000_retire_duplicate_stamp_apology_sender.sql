-- Aplicar somente com autorizacao explicita para a retirada.
-- Mantem eventos, SIDs, indices unicos e politicas que protegem o historico.
drop function if exists public.server_claim_duplicate_stamp_apology(uuid,uuid);

insert into public.audit_events (actor_user_id,action,entity_type,entity_id,payload)
select null,'stamps.duplicate_apology_retired','communication_incident','duplicate-stamps-2026-10',
  jsonb_build_object('sent_events',(select count(*) from public.audit_events where action='stamps.duplicate_apology_sent' and entity_type='loyalty_track'),
    'audit_preserved',true,'claim_rpc_removed',true)
where not exists (
  select 1 from public.audit_events where action='stamps.duplicate_apology_retired'
    and entity_type='communication_incident' and entity_id='duplicate-stamps-2026-10'
);
