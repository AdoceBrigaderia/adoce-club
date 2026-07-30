begin;

alter table public.service_requests
  add column if not exists public_request_key uuid;

create unique index if not exists service_requests_public_request_key_idx
  on public.service_requests (public_request_key)
  where public_request_key is not null;

create or replace function public.submit_service_request_bff(
  requested_operation_key uuid,
  requested_product_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_quantity integer,
  requested_start timestamptz,
  requested_end timestamptz,
  requested_location text default '',
  requested_selections jsonb default '{}'::jsonb,
  requested_notes text default '',
  requested_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  existing_request public.service_requests%rowtype;
  target_request_id uuid;
  linked_profile_id uuid;
begin
  if requested_operation_key is null then
    raise exception 'Chave da solicitação é obrigatória';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-service-request:' || requested_operation_key::text, 0)
  );

  select request.*
  into existing_request
  from public.service_requests request
  where request.public_request_key = requested_operation_key
  limit 1;

  if existing_request.id is not null then
    return jsonb_build_object(
      'accepted', true,
      'request_id', existing_request.id,
      'request_number', existing_request.request_number,
      'expires_at', existing_request.expires_at,
      'conflict', null,
      'competing_prebooks', 0,
      'idempotent', true,
      'message', 'Esta pré-reserva já havia sido registrada.'
    );
  end if;

  response := public.submit_service_request(
    requested_product_id,
    requested_customer_name,
    requested_customer_phone,
    requested_customer_email,
    requested_quantity,
    requested_start,
    requested_end,
    requested_location,
    requested_selections,
    requested_notes
  );

  if not coalesce((response->>'accepted')::boolean, false) then
    return response || jsonb_build_object('idempotent', false);
  end if;

  target_request_id := (response->>'request_id')::uuid;
  if requested_profile_id is not null and exists (
    select 1
    from public.profiles profile
    where profile.id = requested_profile_id
  ) then
    linked_profile_id := requested_profile_id;
  end if;

  update public.service_requests
  set public_request_key = requested_operation_key,
      profile_id = coalesce(linked_profile_id, profile_id)
  where id = target_request_id;

  if not found then
    raise exception 'A pré-reserva foi criada sem vínculo interno';
  end if;

  return response || jsonb_build_object(
    'idempotent', false,
    'profile_linked', linked_profile_id is not null
  );
end;
$$;

revoke all on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) from public, anon, authenticated;
grant execute on function public.submit_service_request_bff(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) to service_role;

-- A pré-reserva pública passa somente pela Function same-origin. O RPC original
-- continua interno para ser reutilizado pela transação protegida acima.
revoke all on function public.submit_service_request(
  uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text
) from public, anon, authenticated;
grant execute on function public.submit_service_request(
  uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text
) to service_role;

commit;
