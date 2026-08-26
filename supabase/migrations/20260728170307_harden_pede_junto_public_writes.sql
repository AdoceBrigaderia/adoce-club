begin;

create table if not exists private.pede_junto_write_requests (
  action text not null check (action in ('create', 'join')),
  operation_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_payload jsonb not null
    check (jsonb_typeof(response_payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  primary key (action, operation_key)
);

revoke all on table private.pede_junto_write_requests
  from public, anon, authenticated;
grant all on table private.pede_junto_write_requests to service_role;

create index if not exists pede_junto_write_requests_expiry_idx
  on private.pede_junto_write_requests (expires_at);

create or replace function public.create_pede_junto_group_v2(
  requested_operation_key uuid,
  group_name text,
  organizer_name text,
  organizer_phone text,
  delivery_address text,
  delivery_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_request jsonb;
  calculated_hash text;
  previous_request private.pede_junto_write_requests%rowtype;
  response jsonb;
begin
  if requested_operation_key is null then
    raise exception 'Chave da operação inválida';
  end if;

  normalized_request := jsonb_build_object(
    'group_name', btrim(coalesce(group_name, '')),
    'organizer_name', btrim(coalesce(organizer_name, '')),
    'organizer_phone', regexp_replace(coalesce(organizer_phone, ''), '\D', '', 'g'),
    'delivery_address', btrim(coalesce(delivery_address, '')),
    'delivery_reference', btrim(coalesce(delivery_reference, ''))
  );
  calculated_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'pede-junto:create:' || requested_operation_key::text,
      0
    )
  );

  delete from private.pede_junto_write_requests stored_request
  where stored_request.action = 'create'
    and stored_request.operation_key = requested_operation_key
    and stored_request.expires_at <= now();

  select *
  into previous_request
  from private.pede_junto_write_requests stored_request
  where stored_request.action = 'create'
    and stored_request.operation_key = requested_operation_key;

  if found then
    if previous_request.request_hash <> calculated_hash then
      raise exception 'A chave da operação já foi usada com outro grupo';
    end if;
    return previous_request.response_payload
      || jsonb_build_object('idempotent', true);
  end if;

  response := public.create_pede_junto_group(
    group_name,
    organizer_name,
    organizer_phone,
    delivery_address,
    delivery_reference
  );

  insert into private.pede_junto_write_requests(
    action,
    operation_key,
    request_hash,
    response_payload
  )
  values ('create', requested_operation_key, calculated_hash, response);

  return response || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.join_pede_junto_group_v3(
  requested_operation_key uuid,
  group_code text,
  invitation_token text,
  participant_name text,
  participant_phone text,
  current_participant_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_request jsonb;
  calculated_hash text;
  previous_request private.pede_junto_write_requests%rowtype;
  response jsonb;
begin
  if requested_operation_key is null then
    raise exception 'Chave da operação inválida';
  end if;

  normalized_request := jsonb_build_object(
    'group_code', upper(btrim(coalesce(group_code, ''))),
    'invitation_token', btrim(coalesce(invitation_token, '')),
    'participant_name', btrim(coalesce(participant_name, '')),
    'participant_phone', regexp_replace(coalesce(participant_phone, ''), '\D', '', 'g')
  );
  calculated_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'pede-junto:join:' || requested_operation_key::text,
      0
    )
  );

  delete from private.pede_junto_write_requests stored_request
  where stored_request.action = 'join'
    and stored_request.operation_key = requested_operation_key
    and stored_request.expires_at <= now();

  select *
  into previous_request
  from private.pede_junto_write_requests stored_request
  where stored_request.action = 'join'
    and stored_request.operation_key = requested_operation_key;

  if found then
    if previous_request.request_hash <> calculated_hash then
      raise exception 'A chave da operação já foi usada por outro participante';
    end if;
    return previous_request.response_payload
      || jsonb_build_object('idempotent', true);
  end if;

  response := public.join_pede_junto_group_v2(
    group_code,
    invitation_token,
    participant_name,
    participant_phone,
    current_participant_token
  );

  insert into private.pede_junto_write_requests(
    action,
    operation_key,
    request_hash,
    response_payload
  )
  values ('join', requested_operation_key, calculated_hash, response);

  return response || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.create_pede_junto_group(
  text,text,text,text,text
) from public, anon, authenticated, service_role;
revoke all on function public.join_pede_junto_group_v2(
  text,text,text,text,text
) from public, anon, authenticated, service_role;

revoke all on function public.create_pede_junto_group_v2(
  uuid,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.create_pede_junto_group_v2(
  uuid,text,text,text,text,text
) to service_role;

revoke all on function public.join_pede_junto_group_v3(
  uuid,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.join_pede_junto_group_v3(
  uuid,text,text,text,text,text
) to service_role;

comment on table private.pede_junto_write_requests is
  'Respostas privadas para repetir criação e entrada no Pede Junto sem duplicar dados.';
comment on function public.create_pede_junto_group_v2(
  uuid,text,text,text,text,text
) is
  'Cria um grupo Pede Junto uma única vez por chave de operação.';
comment on function public.join_pede_junto_group_v3(
  uuid,text,text,text,text,text
) is
  'Registra uma entrada no Pede Junto uma única vez por chave de operação.';

commit;
