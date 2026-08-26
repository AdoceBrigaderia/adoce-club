-- Analytics agregados e sem dados pessoais: nenhum nome, telefone, e-mail, IP ou cookie.

create table if not exists public.site_analytics_events (
  event_id uuid primary key,
  event_name text not null check (event_name in (
    'page_view', 'whatsapp_click', 'product_view', 'prebook_start',
    'prebook_submit', 'prebook_success', 'prebook_error', 'schedule_open',
    'pede_junto_start', 'club_join_start'
  )),
  page_path text not null check (char_length(page_path) between 1 and 160),
  properties jsonb not null default '{}'::jsonb check (
    jsonb_typeof(properties) = 'object'
    and octet_length(properties::text) <= 1200
  ),
  occurred_at timestamptz not null default now()
);

create index if not exists site_analytics_events_name_time_idx
  on public.site_analytics_events(event_name, occurred_at desc);
create index if not exists site_analytics_events_path_time_idx
  on public.site_analytics_events(page_path, occurred_at desc);

alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from public, anon, authenticated;
grant select on public.site_analytics_events to authenticated;

drop policy if exists site_analytics_manager_read on public.site_analytics_events;
create policy site_analytics_manager_read on public.site_analytics_events
  for select to authenticated
  using ((select private.is_manager()));

create or replace function public.record_site_analytics_event(
  requested_event_id uuid,
  requested_event_name text,
  requested_page_path text,
  requested_properties jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_properties jsonb;
begin
  if requested_event_id is null
    or requested_event_name not in (
      'page_view', 'whatsapp_click', 'product_view', 'prebook_start',
      'prebook_submit', 'prebook_success', 'prebook_error', 'schedule_open',
      'pede_junto_start', 'club_join_start'
    )
    or requested_page_path is null
    or char_length(requested_page_path) not between 1 and 160
  then
    return false;
  end if;

  safe_properties := coalesce(requested_properties, '{}'::jsonb);
  if jsonb_typeof(safe_properties) <> 'object' or octet_length(safe_properties::text) > 1200 then
    return false;
  end if;

  -- A lista elimina chaves livres e impede o envio acidental de dados pessoais.
  safe_properties := jsonb_strip_nulls(jsonb_build_object(
    'segment', safe_properties -> 'segment',
    'product_id', safe_properties -> 'product_id',
    'product_slug', safe_properties -> 'product_slug',
    'source', safe_properties -> 'source',
    'channel', safe_properties -> 'channel',
    'result', safe_properties -> 'result',
    'device', safe_properties -> 'device'
  ));

  insert into public.site_analytics_events(event_id, event_name, page_path, properties)
  values (requested_event_id, requested_event_name, requested_page_path, safe_properties)
  on conflict (event_id) do nothing;
  return true;
end;
$$;

revoke all on function public.record_site_analytics_event(uuid,text,text,jsonb) from public;
grant execute on function public.record_site_analytics_event(uuid,text,text,jsonb) to anon, authenticated;
