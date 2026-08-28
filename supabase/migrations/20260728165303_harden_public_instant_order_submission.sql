begin;

create table if not exists private.public_instant_order_requests (
  operation_key uuid primary key,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_payload jsonb not null
    check (jsonb_typeof(response_payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

revoke all on table private.public_instant_order_requests
  from public, anon, authenticated;
grant all on table private.public_instant_order_requests to service_role;

create index if not exists public_instant_order_requests_expiry_idx
  on private.public_instant_order_requests (expires_at);

create or replace function public.submit_instant_order_v6(
  requested_operation_key uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default '',
  requested_payment_method text default 'pix',
  requested_reward jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_request jsonb;
  calculated_request_hash text;
  previous_request private.public_instant_order_requests%rowtype;
  response jsonb;
  phone_rate_limit jsonb;
  account_rate_limit jsonb;
  caller_id uuid := auth.uid();
begin
  if requested_operation_key is null then
    raise exception 'Chave da operação inválida';
  end if;

  normalized_request := jsonb_build_object(
    'customer_name', btrim(coalesce(requested_customer_name, '')),
    'customer_phone', regexp_replace(
      coalesce(requested_customer_phone, ''),
      '\D',
      '',
      'g'
    ),
    'items', coalesce(requested_items, 'null'::jsonb),
    'notes', btrim(coalesce(requested_notes, '')),
    'payment_method', btrim(coalesce(requested_payment_method, '')),
    'reward', coalesce(requested_reward, 'null'::jsonb)
  );
  calculated_request_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'public-instant-order:' || requested_operation_key::text,
      0
    )
  );

  delete from private.public_instant_order_requests stored_request
  where stored_request.operation_key = requested_operation_key
    and stored_request.expires_at <= now();

  select *
  into previous_request
  from private.public_instant_order_requests stored_request
  where stored_request.operation_key = requested_operation_key;

  if found then
    if previous_request.request_hash <> calculated_request_hash then
      raise exception 'A chave da operação já foi usada com outro pedido';
    end if;
    return previous_request.response_payload
      || jsonb_build_object('idempotent', true);
  end if;

  phone_rate_limit := public.consume_public_endpoint_rate_limit_bff(
    'instant-order:db-phone',
    encode(
      extensions.digest(
        'phone:' || normalized_request->>'customer_phone',
        'sha256'
      ),
      'hex'
    ),
    3600,
    8
  );
  if not coalesce((phone_rate_limit->>'allowed')::boolean, false) then
    raise exception 'Muitas tentativas. Aguarde antes de enviar outro pedido.';
  end if;

  if caller_id is not null then
    account_rate_limit := public.consume_public_endpoint_rate_limit_bff(
      'instant-order:db-account',
      encode(
        extensions.digest('account:' || caller_id::text, 'sha256'),
        'hex'
      ),
      3600,
      12
    );
    if not coalesce((account_rate_limit->>'allowed')::boolean, false) then
      raise exception 'Muitas tentativas. Aguarde antes de enviar outro pedido.';
    end if;
  end if;

  response := public.submit_instant_order_v5(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes,
    requested_payment_method,
    requested_reward
  );

  insert into private.public_instant_order_requests(
    operation_key,
    request_hash,
    response_payload
  )
  values (
    requested_operation_key,
    calculated_request_hash,
    response
  );

  return response || jsonb_build_object('idempotent', false);
end;
$$;

-- Toda nova submissão deve passar pela versão idempotente.
revoke all on function public.submit_instant_order_v5(
  text,text,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;

revoke all on function public.submit_instant_order_v6(
  uuid,text,text,jsonb,text,text,jsonb
) from public, anon;
grant execute on function public.submit_instant_order_v6(
  uuid,text,text,jsonb,text,text,jsonb
) to authenticated, service_role;

comment on table private.public_instant_order_requests is
  'Respostas privadas de idempotência para impedir pedidos instantâneos duplicados.';
comment on function public.submit_instant_order_v6(
  uuid,text,text,jsonb,text,text,jsonb
) is
  'Submete pedido instantâneo com limites no banco, trava transacional e resposta idempotente.';

commit;
