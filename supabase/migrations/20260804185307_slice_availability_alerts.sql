-- Lista de interesse para fatias temporariamente indisponiveis.
-- Dados pessoais ficam restritos a equipe; o publico grava somente pela RPC validada.

create table public.slice_availability_alerts (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  first_name text not null check (char_length(first_name) between 2 and 80),
  last_name text not null check (char_length(last_name) between 2 and 120),
  phone_e164 text not null check (phone_e164 ~ '^\+55[0-9]{10,11}$'),
  status text not null default 'waiting' check (status in ('waiting', 'queued', 'sent', 'cancelled')),
  availability_cycle integer not null default 0 check (availability_cycle >= 0),
  queued_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancel_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flavor_id, phone_e164)
);

create index slice_availability_alerts_queue_idx
  on public.slice_availability_alerts(status, queued_at)
  where status in ('waiting', 'queued');

alter table public.slice_availability_alerts enable row level security;
revoke all on public.slice_availability_alerts from public, anon, authenticated;
grant select, update on public.slice_availability_alerts to authenticated;
grant all on public.slice_availability_alerts to service_role;

create policy slice_availability_alerts_staff_read
  on public.slice_availability_alerts for select to authenticated
  using ((select private.is_staff()));
create policy slice_availability_alerts_staff_update
  on public.slice_availability_alerts for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create or replace function public.subscribe_slice_availability_alert(
  requested_flavor_id uuid,
  requested_first_name text,
  requested_last_name text,
  requested_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text := private.normalize_br_phone(requested_phone);
  raw_token text := encode(extensions.gen_random_bytes(24), 'hex');
  target_flavor public.flavors%rowtype;
  target_id uuid;
begin
  select * into target_flavor
  from public.flavors
  where id = requested_flavor_id and active = true;
  if target_flavor.id is null then raise exception 'Sabor nao encontrado'; end if;
  if char_length(btrim(coalesce(requested_first_name, ''))) < 2 then raise exception 'Informe seu primeiro nome'; end if;
  if char_length(btrim(coalesce(requested_last_name, ''))) < 2 then raise exception 'Informe seu sobrenome'; end if;

  insert into public.slice_availability_alerts(
    flavor_id, profile_id, first_name, last_name, phone_e164, status,
    queued_at, sent_at, cancelled_at, cancel_token_hash, updated_at
  ) values (
    target_flavor.id,
    (select case when exists(select 1 from public.profiles where id = auth.uid()) then auth.uid() else null end),
    btrim(requested_first_name),
    btrim(requested_last_name), normalized_phone, 'waiting', null, null, null,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'), now()
  )
  on conflict (flavor_id, phone_e164) do update set
    profile_id = coalesce(
      (select case when exists(select 1 from public.profiles where id = auth.uid()) then auth.uid() else null end),
      public.slice_availability_alerts.profile_id
    ),
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    status = 'waiting', queued_at = null, sent_at = null, cancelled_at = null,
    cancel_token_hash = excluded.cancel_token_hash, updated_at = now()
  returning id into target_id;

  return jsonb_build_object(
    'accepted', true,
    'subscription_id', target_id,
    'cancel_token', raw_token,
    'flavor_name', target_flavor.name
  );
end;
$$;

create or replace function public.cancel_slice_availability_alert(cancel_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.slice_availability_alerts
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where cancel_token_hash = encode(extensions.digest(cancel_token, 'sha256'), 'hex')
    and status in ('waiting', 'queued');
  return found;
end;
$$;

revoke all on function public.subscribe_slice_availability_alert(uuid, text, text, text) from public;
revoke all on function public.cancel_slice_availability_alert(text) from public;
grant execute on function public.subscribe_slice_availability_alert(uuid, text, text, text) to anon, authenticated;
grant execute on function public.cancel_slice_availability_alert(text) to anon, authenticated;

create or replace function private.queue_slice_availability_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued_count integer;
  flavor_name text;
begin
  -- Um aviso só entra na fila quando a disponibilidade vale para hoje.
  -- Assim, um agendamento futuro não dispara mensagem antes da hora.
  if new.service_date <> current_date then
    return new;
  end if;

  if new.status not in ('available', 'last_units', 'preorder_only')
     or (tg_op = 'UPDATE' and old.status in ('available', 'last_units', 'preorder_only')) then
    return new;
  end if;

  update public.slice_availability_alerts
  set status = 'queued', queued_at = now(), sent_at = null,
      availability_cycle = availability_cycle + 1, updated_at = now()
  where flavor_id = new.flavor_id and status = 'waiting';
  get diagnostics queued_count = row_count;

  if queued_count > 0 then
    select name into flavor_name from public.flavors where id = new.flavor_id;
    insert into public.operation_notifications(
      event_type, priority, title, message, entity_type, entity_id, action_url, metadata
    ) values (
      'slice.alerts.queued', 'important', 'Clientes aguardam esta fatia',
      queued_count || ' cliente(s) aguardam ' || coalesce(flavor_name, 'esta fatia') || '.',
      'flavor', new.flavor_id::text, '#operacao-conteudo?tab=today',
      jsonb_build_object('flavor_id', new.flavor_id, 'queued_count', queued_count)
    );
  end if;
  return new;
end;
$$;

revoke all on function private.queue_slice_availability_alerts() from public, anon, authenticated;
drop trigger if exists flavor_availability_queue_customer_alerts on public.flavor_availability;
create trigger flavor_availability_queue_customer_alerts
  after insert or update of status on public.flavor_availability
  for each row execute function private.queue_slice_availability_alerts();
