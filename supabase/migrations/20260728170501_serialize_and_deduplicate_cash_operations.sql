begin;

create table if not exists private.staff_operation_requests (
  action text not null check (
    action in ('cash_movement', 'manual_sale_in_cash')
  ),
  operation_key uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_payload jsonb not null
    check (jsonb_typeof(response_payload) = 'object'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  primary key (action, operation_key)
);

revoke all on table private.staff_operation_requests
  from public, anon, authenticated;
grant all on table private.staff_operation_requests to service_role;

create index if not exists staff_operation_requests_expiry_idx
  on private.staff_operation_requests (expires_at);

create or replace function public.staff_record_cash_movement_v2(
  requested_operation_key uuid,
  target_session_id uuid,
  movement_kind text,
  requested_payment_method text,
  requested_amount numeric,
  next_notes text default '',
  target_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_request jsonb;
  calculated_hash text;
  previous_request private.staff_operation_requests%rowtype;
  session_record public.cash_sessions%rowtype;
  response jsonb;
begin
  if actor_id is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;
  if requested_operation_key is null then
    raise exception 'Chave de idempotencia invalida';
  end if;

  normalized_request := jsonb_build_object(
    'session_id', target_session_id,
    'kind', btrim(coalesce(movement_kind, '')),
    'payment_method', btrim(coalesce(requested_payment_method, '')),
    'amount', round(coalesce(requested_amount, 0), 2),
    'notes', btrim(coalesce(next_notes, '')),
    'order_id', target_order_id
  );
  calculated_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'staff:cash-movement:' || requested_operation_key::text,
      0
    )
  );

  select *
  into previous_request
  from private.staff_operation_requests stored_request
  where stored_request.action = 'cash_movement'
    and stored_request.operation_key = requested_operation_key;

  if found then
    if previous_request.actor_user_id <> actor_id
       or previous_request.request_hash <> calculated_hash then
      raise exception 'A chave de idempotencia ja foi usada em outra operacao';
    end if;
    return previous_request.response_payload
      || jsonb_build_object('idempotent', true);
  end if;

  -- A mesma trava de linha é usada por movimentação, fechamento e cancelamento.
  select *
  into session_record
  from public.cash_sessions
  where id = target_session_id
    and status = 'open'
  for update;
  if not found then
    raise exception 'O caixa nao esta aberto';
  end if;

  response := public.staff_record_cash_movement(
    target_session_id,
    movement_kind,
    requested_payment_method,
    requested_amount,
    next_notes,
    target_order_id
  );

  insert into private.staff_operation_requests(
    action,
    operation_key,
    request_hash,
    response_payload,
    actor_user_id
  )
  values (
    'cash_movement',
    requested_operation_key,
    calculated_hash,
    response,
    actor_id
  );

  return response || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.staff_create_manual_sale_in_cash_v2(
  requested_operation_key uuid,
  target_session_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_payment_method text,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_request jsonb;
  calculated_hash text;
  previous_request private.staff_operation_requests%rowtype;
  response jsonb;
begin
  if actor_id is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;
  if requested_operation_key is null then
    raise exception 'Chave de idempotencia invalida';
  end if;

  normalized_request := jsonb_build_object(
    'session_id', target_session_id,
    'customer_name', btrim(coalesce(requested_customer_name, '')),
    'customer_phone', regexp_replace(
      coalesce(requested_customer_phone, ''),
      '\D',
      '',
      'g'
    ),
    'items', coalesce(requested_items, 'null'::jsonb),
    'payment_method', btrim(coalesce(requested_payment_method, '')),
    'notes', btrim(coalesce(requested_notes, ''))
  );
  calculated_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'staff:manual-sale:' || requested_operation_key::text,
      0
    )
  );

  select *
  into previous_request
  from private.staff_operation_requests stored_request
  where stored_request.action = 'manual_sale_in_cash'
    and stored_request.operation_key = requested_operation_key;

  if found then
    if previous_request.actor_user_id <> actor_id
       or previous_request.request_hash <> calculated_hash then
      raise exception 'A chave de idempotencia ja foi usada em outra operacao';
    end if;
    return previous_request.response_payload
      || jsonb_build_object('idempotent', true);
  end if;

  response := public.staff_create_manual_sale_in_cash(
    target_session_id,
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_payment_method,
    requested_notes
  );

  insert into private.staff_operation_requests(
    action,
    operation_key,
    request_hash,
    response_payload,
    actor_user_id
  )
  values (
    'manual_sale_in_cash',
    requested_operation_key,
    calculated_hash,
    response,
    actor_id
  );

  return response || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.manager_cancel_empty_cash_session(
  target_session_id uuid,
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.cash_sessions%rowtype;
begin
  if not private.is_manager() then
    raise exception 'Apenas gestores podem cancelar uma abertura';
  end if;

  select *
  into target
  from public.cash_sessions
  where id = target_session_id
    and status = 'open'
  for update;
  if not found then
    raise exception 'Abertura nao encontrada';
  end if;

  if exists(
    select 1
    from public.cash_movements
    where cash_session_id = target.id
  ) then
    raise exception 'Caixas com movimentacao devem ser fechados, nao cancelados';
  end if;

  update public.cash_sessions
  set status = 'cancelled',
      closed_by = (select auth.uid()),
      closed_at = now(),
      expected_cash = opening_float,
      counted_cash = opening_float,
      cash_difference = 0,
      closing_notes = left(coalesce(next_notes, ''), 1000),
      updated_at = now()
  where id = target.id
  returning * into target;

  return to_jsonb(target);
end;
$$;

revoke all on function public.staff_record_cash_movement(
  uuid,text,text,numeric,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.staff_create_manual_sale_in_cash(
  uuid,text,text,jsonb,text,text
) from public, anon, authenticated, service_role;

revoke all on function public.staff_record_cash_movement_v2(
  uuid,uuid,text,text,numeric,text,uuid
) from public, anon;
grant execute on function public.staff_record_cash_movement_v2(
  uuid,uuid,text,text,numeric,text,uuid
) to authenticated;

revoke all on function public.staff_create_manual_sale_in_cash_v2(
  uuid,uuid,text,text,jsonb,text,text
) from public, anon;
grant execute on function public.staff_create_manual_sale_in_cash_v2(
  uuid,uuid,text,text,jsonb,text,text
) to authenticated;

comment on table private.staff_operation_requests is
  'Respostas privadas de idempotência para operações financeiras da equipe.';
comment on function public.staff_record_cash_movement_v2(
  uuid,uuid,text,text,numeric,text,uuid
) is
  'Serializa o caixa e registra uma movimentação uma única vez.';
comment on function public.staff_create_manual_sale_in_cash_v2(
  uuid,uuid,text,text,jsonb,text,text
) is
  'Registra venda, estoque e caixa uma única vez por chave de operação.';

commit;
