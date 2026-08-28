begin;

create table if not exists private.auth_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id text not null check (char_length(request_id) between 8 and 160),
  phone_hmac text not null check (phone_hmac ~ '^[a-f0-9]{64}$'),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  phone_last4 text not null check (phone_last4 ~ '^[0-9]{4}$'),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email')),
  provider text not null default 'meta_cloud_api',
  provider_message_id text,
  template_name text,
  status text not null check (status in ('requested', 'accepted', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.whatsapp_auth_requests (
  id uuid primary key,
  phone_hmac text not null check (phone_hmac ~ '^[a-f0-9]{64}$'),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'verified', 'expired')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists whatsapp_auth_requests_phone_created_idx
  on private.whatsapp_auth_requests(phone_hmac, created_at desc);
create index if not exists whatsapp_auth_requests_expiry_idx
  on private.whatsapp_auth_requests(expires_at)
  where status = 'requested';

revoke all on table private.whatsapp_auth_requests from public, anon, authenticated;
grant select, insert, update on table private.whatsapp_auth_requests to service_role;

create unique index if not exists auth_delivery_provider_message_uidx
  on private.auth_delivery_attempts(provider, provider_message_id)
  where provider_message_id is not null;
create index if not exists auth_delivery_phone_created_idx
  on private.auth_delivery_attempts(phone_hmac, created_at desc);
create index if not exists auth_delivery_request_idx
  on private.auth_delivery_attempts(request_id, created_at desc);

revoke all on table private.auth_delivery_attempts from public, anon, authenticated;
grant select, insert, update on table private.auth_delivery_attempts to service_role;

comment on table private.auth_delivery_attempts is
  'Telemetria minima da entrega de autenticacao; nunca armazena OTP, token ou telefone completo.';

comment on table private.whatsapp_auth_requests is
  'Vincula um desafio opaco ao HMAC do telefone; nao armazena telefone ou codigo em claro.';

create or replace function public.server_register_whatsapp_auth_request(
  requested_id uuid,
  requested_phone_hmac text,
  requested_expires_at timestamptz,
  requested_actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(requested_phone_hmac, '') !~ '^[a-f0-9]{64}$'
     or requested_expires_at <= now()
     or requested_expires_at > now() + interval '15 minutes' then
    raise exception 'Desafio de autenticacao invalido' using errcode = '22023';
  end if;

  insert into private.whatsapp_auth_requests(id, phone_hmac, expires_at, requested_by_user_id)
  values (requested_id, requested_phone_hmac, requested_expires_at, requested_actor_user_id)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.server_check_whatsapp_auth_request(
  requested_id uuid,
  requested_phone_hmac text,
  mark_verified boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched boolean;
begin
  update private.whatsapp_auth_requests request
  set status = 'expired'
  where request.id = requested_id
    and request.status = 'requested'
    and request.expires_at <= now();

  select exists(
    select 1
    from private.whatsapp_auth_requests request
    where request.id = requested_id
      and request.phone_hmac = requested_phone_hmac
      and request.status = 'requested'
      and request.expires_at > now()
  ) into matched;

  if matched and mark_verified then
    update private.whatsapp_auth_requests request
    set status = 'verified',
        verified_at = now()
    where request.id = requested_id
      and request.phone_hmac = requested_phone_hmac
      and request.status = 'requested';
  end if;

  return matched;
end;
$$;

revoke all on function public.server_register_whatsapp_auth_request(uuid,text,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.server_register_whatsapp_auth_request(uuid,text,timestamptz,uuid)
  to service_role;
revoke all on function public.server_check_whatsapp_auth_request(uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.server_check_whatsapp_auth_request(uuid,text,boolean)
  to service_role;

create or replace function public.server_has_pending_whatsapp_auth_request(
  requested_phone_hmac text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from private.whatsapp_auth_requests request
    where request.phone_hmac = requested_phone_hmac
      and request.status = 'requested'
      and request.expires_at > now()
  );
$$;

revoke all on function public.server_has_pending_whatsapp_auth_request(text)
  from public, anon, authenticated;
grant execute on function public.server_has_pending_whatsapp_auth_request(text)
  to service_role;

create or replace function public.server_record_whatsapp_auth_delivery(
  requested_request_id text,
  requested_phone_hmac text,
  requested_phone_last4 text,
  requested_provider_message_id text,
  requested_template_name text,
  requested_status text,
  requested_error_code text,
  requested_latency_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(requested_request_id, '')) not between 8 and 160
     or coalesce(requested_phone_hmac, '') !~ '^[a-f0-9]{64}$'
     or coalesce(requested_phone_last4, '') !~ '^[0-9]{4}$'
     or requested_status not in ('accepted', 'failed')
     or requested_latency_ms < 0 then
    raise exception 'Evento de entrega invalido' using errcode = '22023';
  end if;

  insert into private.auth_delivery_attempts(
    request_id,
    phone_hmac,
    phone_last4,
    channel,
    provider,
    provider_message_id,
    template_name,
    status,
    error_code,
    latency_ms
  ) values (
    requested_request_id,
    requested_phone_hmac,
    requested_phone_last4,
    'whatsapp',
    'meta_cloud_api',
    nullif(requested_provider_message_id, ''),
    nullif(requested_template_name, ''),
    requested_status,
    nullif(left(coalesce(requested_error_code, ''), 80), ''),
    requested_latency_ms
  )
  on conflict (provider, provider_message_id)
    where provider_message_id is not null
  do update set
    status = excluded.status,
    error_code = excluded.error_code,
    latency_ms = excluded.latency_ms,
    updated_at = now();
end;
$$;

revoke all on function public.server_record_whatsapp_auth_delivery(
  text,text,text,text,text,text,text,integer
) from public, anon, authenticated;
grant execute on function public.server_record_whatsapp_auth_delivery(
  text,text,text,text,text,text,text,integer
) to service_role;

commit;
