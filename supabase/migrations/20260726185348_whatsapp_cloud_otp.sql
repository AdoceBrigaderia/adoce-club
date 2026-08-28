begin;

create table if not exists public.whatsapp_auth_challenges (
  id uuid primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  phone_e164 text not null check (phone_e164 ~ '^\+55[0-9]{10,11}$'),
  phone_hash text not null check (phone_hash ~ '^[a-f0-9]{64}$'),
  purpose text not null check (purpose in ('registration','recovery','phone_change','risk_check')),
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 12 and 160),
  request_ip_hash text not null check (request_ip_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'created' check (
    status in ('created','sent','delivered','read','verified','failed','expired','blocked')
  ),
  attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 5 check (max_attempts between 3 and 10),
  expires_at timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  verified_at timestamptz,
  failed_at timestamptz,
  provider_message_id text unique,
  provider_error_code text,
  provider_error_title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists whatsapp_auth_challenges_phone_rate_idx
  on public.whatsapp_auth_challenges(phone_hash, created_at desc);
create index if not exists whatsapp_auth_challenges_ip_rate_idx
  on public.whatsapp_auth_challenges(request_ip_hash, created_at desc);
create index if not exists whatsapp_auth_challenges_profile_idx
  on public.whatsapp_auth_challenges(profile_id, created_at desc)
  where profile_id is not null;

alter table public.whatsapp_auth_challenges enable row level security;
revoke all on public.whatsapp_auth_challenges from public, anon, authenticated;

drop trigger if exists whatsapp_auth_challenges_touch_updated_at
  on public.whatsapp_auth_challenges;
create trigger whatsapp_auth_challenges_touch_updated_at
before update on public.whatsapp_auth_challenges
for each row execute function private.touch_updated_at();

create or replace function public.server_create_whatsapp_auth_challenge(
  challenge_id uuid,
  raw_phone text,
  requested_purpose text,
  requested_code_hash text,
  requested_idempotency_key text,
  requested_ip_hash text,
  requested_expires_at timestamptz,
  requested_profile_id uuid default null,
  requested_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  digits text;
  national text;
  normalized_phone text;
  normalized_phone_hash text;
  existing public.whatsapp_auth_challenges%rowtype;
  created public.whatsapp_auth_challenges%rowtype;
begin
  select * into existing
  from public.whatsapp_auth_challenges
  where idempotency_key = requested_idempotency_key;
  if existing.id is not null then
    return jsonb_build_object(
      'challenge_id', existing.id,
      'phone_e164', existing.phone_e164,
      'expires_at', existing.expires_at,
      'status', existing.status,
      'duplicate', true,
      'provider_message_id', existing.provider_message_id
    );
  end if;

  digits := pg_catalog.regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');
  national := case when digits like '55%' then substring(digits from 3) else digits end;
  if pg_catalog.length(national) not in (10, 11) then
    raise exception 'Telefone inválido' using errcode = '22023';
  end if;
  normalized_phone := '+55' || national;
  normalized_phone_hash := pg_catalog.encode(
    extensions.digest(normalized_phone, 'sha256'),
    'hex'
  );

  if requested_purpose not in ('registration','recovery','phone_change','risk_check') then
    raise exception 'Finalidade inválida' using errcode = '22023';
  end if;
  if requested_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Hash do código inválido' using errcode = '22023';
  end if;
  if requested_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Hash de origem inválido' using errcode = '22023';
  end if;
  if pg_catalog.char_length(coalesce(requested_idempotency_key, '')) < 12 then
    raise exception 'Chave de idempotência inválida' using errcode = '22023';
  end if;
  if requested_expires_at <= now() or requested_expires_at > now() + interval '15 minutes' then
    raise exception 'Expiração inválida' using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.whatsapp_auth_challenges challenge
    where challenge.phone_hash = normalized_phone_hash
      and challenge.created_at >= now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'Muitas solicitações para este número' using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.whatsapp_auth_challenges challenge
    where challenge.request_ip_hash = requested_ip_hash
      and challenge.created_at >= now() - interval '15 minutes'
  ) >= 30 then
    raise exception 'Muitas solicitações nesta conexão' using errcode = 'P0001';
  end if;

  insert into public.whatsapp_auth_challenges(
    id,
    profile_id,
    phone_e164,
    phone_hash,
    purpose,
    code_hash,
    idempotency_key,
    request_ip_hash,
    expires_at,
    metadata
  ) values (
    challenge_id,
    requested_profile_id,
    normalized_phone,
    normalized_phone_hash,
    requested_purpose,
    requested_code_hash,
    requested_idempotency_key,
    requested_ip_hash,
    requested_expires_at,
    coalesce(requested_metadata, '{}'::jsonb)
  ) returning * into created;

  return jsonb_build_object(
    'challenge_id', created.id,
    'phone_e164', created.phone_e164,
    'expires_at', created.expires_at,
    'status', created.status,
    'duplicate', false,
    'provider_message_id', null
  );
exception when unique_violation then
  select * into existing
  from public.whatsapp_auth_challenges
  where idempotency_key = requested_idempotency_key;
  return jsonb_build_object(
    'challenge_id', existing.id,
    'phone_e164', existing.phone_e164,
    'expires_at', existing.expires_at,
    'status', existing.status,
    'duplicate', true,
    'provider_message_id', existing.provider_message_id
  );
end;
$$;

create or replace function public.server_mark_whatsapp_auth_sent(
  challenge_id uuid,
  provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.char_length(coalesce(provider_message_id, '')) < 8 then
    raise exception 'Identificador do provedor inválido';
  end if;
  update public.whatsapp_auth_challenges challenge
  set status = 'sent',
      provider_message_id = server_mark_whatsapp_auth_sent.provider_message_id,
      sent_at = now(),
      provider_error_code = null,
      provider_error_title = null
  where challenge.id = server_mark_whatsapp_auth_sent.challenge_id
    and challenge.status = 'created';
  if not found then raise exception 'Desafio indisponível'; end if;
end;
$$;

create or replace function public.server_mark_whatsapp_auth_failed(
  challenge_id uuid,
  error_code text,
  error_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.whatsapp_auth_challenges challenge
  set status = 'failed',
      failed_at = now(),
      provider_error_code = pg_catalog.left(coalesce(error_code, ''), 80),
      provider_error_title = pg_catalog.left(coalesce(error_title, ''), 500)
  where challenge.id = server_mark_whatsapp_auth_failed.challenge_id
    and challenge.status in ('created','sent');
end;
$$;

create or replace function public.server_update_whatsapp_auth_delivery(
  requested_provider_message_id text,
  requested_status text,
  provider_timestamp timestamptz default now(),
  error_code text default null,
  error_title text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_status not in ('sent','delivered','read','failed','deleted') then
    return;
  end if;

  update public.whatsapp_auth_challenges challenge
  set status = case
        when requested_status = 'deleted' then 'failed'
        else requested_status
      end,
      sent_at = case when requested_status = 'sent' then coalesce(challenge.sent_at, provider_timestamp) else challenge.sent_at end,
      delivered_at = case when requested_status = 'delivered' then provider_timestamp else challenge.delivered_at end,
      read_at = case when requested_status = 'read' then provider_timestamp else challenge.read_at end,
      failed_at = case when requested_status in ('failed','deleted') then provider_timestamp else challenge.failed_at end,
      provider_error_code = case when requested_status in ('failed','deleted') then pg_catalog.left(coalesce(error_code, ''), 80) else challenge.provider_error_code end,
      provider_error_title = case when requested_status in ('failed','deleted') then pg_catalog.left(coalesce(error_title, ''), 500) else challenge.provider_error_title end
  where challenge.provider_message_id = requested_provider_message_id
    and challenge.status <> 'verified'
    and (
      requested_status in ('failed','deleted')
      or (requested_status = 'sent' and challenge.status in ('created','sent'))
      or (requested_status = 'delivered' and challenge.status in ('created','sent','delivered'))
      or (requested_status = 'read' and challenge.status in ('created','sent','delivered','read'))
    );
end;
$$;

create or replace function public.server_verify_whatsapp_auth_challenge(
  challenge_id uuid,
  requested_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge public.whatsapp_auth_challenges%rowtype;
  next_attempts smallint;
begin
  select * into challenge
  from public.whatsapp_auth_challenges row_to_lock
  where row_to_lock.id = server_verify_whatsapp_auth_challenge.challenge_id
  for update;

  if challenge.id is null then
    return jsonb_build_object('verified', false, 'reason', 'invalid');
  end if;
  if challenge.status = 'verified' and challenge.code_hash = requested_code_hash then
    return jsonb_build_object(
      'verified', true,
      'reason', 'already_verified',
      'profile_id', challenge.profile_id,
      'phone_e164', challenge.phone_e164,
      'purpose', challenge.purpose
    );
  end if;
  if challenge.expires_at <= now() then
    update public.whatsapp_auth_challenges set status = 'expired' where id = challenge.id;
    return jsonb_build_object('verified', false, 'reason', 'expired');
  end if;
  if challenge.status in ('failed','expired','blocked') or challenge.attempts >= challenge.max_attempts then
    update public.whatsapp_auth_challenges set status = 'blocked' where id = challenge.id and status <> 'failed';
    return jsonb_build_object('verified', false, 'reason', 'blocked');
  end if;

  next_attempts := challenge.attempts + 1;
  if challenge.code_hash <> requested_code_hash then
    update public.whatsapp_auth_challenges
    set attempts = next_attempts,
        status = case when next_attempts >= challenge.max_attempts then 'blocked' else challenge.status end
    where id = challenge.id;
    return jsonb_build_object(
      'verified', false,
      'reason', case when next_attempts >= challenge.max_attempts then 'blocked' else 'invalid' end,
      'attempts_remaining', greatest(challenge.max_attempts - next_attempts, 0)
    );
  end if;

  update public.whatsapp_auth_challenges
  set attempts = next_attempts,
      status = 'verified',
      verified_at = now()
  where id = challenge.id;

  if challenge.profile_id is not null then
    update public.profiles
    set whatsapp_verified_at = now(),
        updated_at = now()
    where id = challenge.profile_id
      and phone_e164 = challenge.phone_e164;
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    challenge.profile_id,
    'security.whatsapp_otp_verified',
    'whatsapp_auth_challenge',
    challenge.id::text,
    jsonb_build_object('purpose', challenge.purpose, 'phone_hash', challenge.phone_hash)
  );

  return jsonb_build_object(
    'verified', true,
    'reason', 'verified',
    'profile_id', challenge.profile_id,
    'phone_e164', challenge.phone_e164,
    'purpose', challenge.purpose
  );
end;
$$;

revoke all on function public.server_create_whatsapp_auth_challenge(uuid,text,text,text,text,text,timestamptz,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.server_mark_whatsapp_auth_sent(uuid,text) from public, anon, authenticated;
revoke all on function public.server_mark_whatsapp_auth_failed(uuid,text,text) from public, anon, authenticated;
revoke all on function public.server_update_whatsapp_auth_delivery(text,text,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.server_verify_whatsapp_auth_challenge(uuid,text) from public, anon, authenticated;

grant execute on function public.server_create_whatsapp_auth_challenge(uuid,text,text,text,text,text,timestamptz,uuid,jsonb) to service_role;
grant execute on function public.server_mark_whatsapp_auth_sent(uuid,text) to service_role;
grant execute on function public.server_mark_whatsapp_auth_failed(uuid,text,text) to service_role;
grant execute on function public.server_update_whatsapp_auth_delivery(text,text,timestamptz,text,text) to service_role;
grant execute on function public.server_verify_whatsapp_auth_challenge(uuid,text) to service_role;

commit;
