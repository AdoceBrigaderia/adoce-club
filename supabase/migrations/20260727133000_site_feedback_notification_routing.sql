begin;

-- Keep delivery-provider details outside the public request. The outbox records
-- only a stable business route; a future server-side worker resolves that route
-- to the current corporate group without exposing Workspace credentials.
create or replace function private.route_site_feedback_outbox()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.topic = 'site_feedback.created' then
    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
      'notification_channel', 'email',
      'notification_route', 'business.atendimento'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.route_site_feedback_outbox()
  from public, anon, authenticated;

drop trigger if exists route_site_feedback_outbox_trigger
  on public.outbox_events;

create trigger route_site_feedback_outbox_trigger
before insert or update of topic, payload
on public.outbox_events
for each row
execute function private.route_site_feedback_outbox();

-- Existing pending events receive the same stable route. No recipient address,
-- token or provider credential is persisted in the event payload.
update public.outbox_events
set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
  'notification_channel', 'email',
  'notification_route', 'business.atendimento'
)
where topic = 'site_feedback.created'
  and coalesce(payload->>'notification_route', '') = '';

commit;
