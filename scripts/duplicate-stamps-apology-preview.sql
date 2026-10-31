-- SOMENTE LEITURA. Sem segredos Twilio, sem envio, sem dados persistidos localmente.
with incident as (
  select track_id, subject_profile_id, stamps_delta from public.ledger_entries
  where idempotency_key like 'dup-reversal:%'
), recipients as (
  select i.track_id, i.subject_profile_id as profile_id, p.full_name, p.phone_e164,
    t.current_progress,
    exists (select 1 from public.rewards r where r.track_id = i.track_id and r.status = 'reversed') as reversed_reward
  from incident i
  left join public.profiles p on p.id = i.subject_profile_id
  left join public.loyalty_tracks t on t.id = i.track_id
), audit as (
  select entity_id, action from public.audit_events
  where entity_type = 'loyalty_track'
    and action in ('stamps.duplicate_apology_claimed','stamps.duplicate_apology_sent','stamps.duplicate_apology_failed')
    and entity_id in (select track_id::text from incident)
)
select (select count(*) from incident) as reversals,
  (select sum(-stamps_delta) from incident) as stamps,
  (select count(distinct subject_profile_id) from incident) as customers,
  (select jsonb_agg(to_jsonb(r) order by track_id) from recipients r) as recipients,
  coalesce((select jsonb_agg(distinct entity_id) from audit),'[]'::jsonb) as blocked_ids,
  (select count(distinct entity_id) from audit where action = 'stamps.duplicate_apology_sent') as sent,
  (select count(distinct entity_id) from audit where action = 'stamps.duplicate_apology_failed') as failed;
