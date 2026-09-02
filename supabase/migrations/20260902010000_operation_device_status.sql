begin;

create table if not exists public.operation_device_status (
  device_key text primary key,
  device_label text not null,
  service_state text not null default 'offline',
  tablet_online boolean not null default false,
  printer_online boolean not null default false,
  pending_count integer not null default 0 check (pending_count >= 0),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operation_device_status enable row level security;
drop policy if exists operation_device_status_staff_select on public.operation_device_status;
create policy operation_device_status_staff_select on public.operation_device_status
  for select to authenticated using (private.is_staff());

create or replace function public.staff_upsert_operation_device_status(
  p_device_key text,
  p_device_label text,
  p_service_state text,
  p_printer_online boolean,
  p_pending_count integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nÃ£o autorizado';
  end if;
  if p_device_key is null or char_length(trim(p_device_key)) < 3 then
    raise exception 'Dispositivo invÃ¡lido';
  end if;
  insert into public.operation_device_status(device_key, device_label, service_state, tablet_online, printer_online, pending_count, last_seen_at, updated_at)
  values (trim(p_device_key), coalesce(nullif(trim(p_device_label), ''), trim(p_device_key)), coalesce(nullif(trim(p_service_state), ''), 'online'), true, coalesce(p_printer_online, false), greatest(coalesce(p_pending_count, 0), 0), now(), now())
  on conflict (device_key) do update set
    device_label = excluded.device_label,
    service_state = excluded.service_state,
    tablet_online = true,
    printer_online = excluded.printer_online,
    pending_count = excluded.pending_count,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.staff_upsert_operation_device_status(text,text,text,boolean,integer) from public, anon;
grant execute on function public.staff_upsert_operation_device_status(text,text,text,boolean,integer) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.operation_device_status;
exception when duplicate_object then null;
end $$;

commit;
