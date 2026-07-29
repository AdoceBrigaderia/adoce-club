begin;

alter table public.service_requests
  add column if not exists quoted_at timestamptz,
  add column if not exists deposit_payment_method text,
  add column if not exists deposit_confirmed_by uuid,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paid_amount numeric(16,2) not null default 0,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists balance_payment_method text,
  add column if not exists payment_confirmed_by uuid,
  add column if not exists production_started_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_method text,
  add column if not exists refund_confirmed_by uuid,
  add column if not exists last_action text,
  add column if not exists last_action_at timestamptz,
  add column if not exists last_action_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and conname = 'service_requests_payment_status_check'
  ) then
    alter table public.service_requests
      add constraint service_requests_payment_status_check
      check (payment_status in ('pending', 'partial', 'paid', 'refund_pending', 'refunded')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and conname = 'service_requests_paid_amount_check'
  ) then
    alter table public.service_requests
      add constraint service_requests_paid_amount_check
      check (paid_amount >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and conname = 'service_requests_deposit_payment_method_check'
  ) then
    alter table public.service_requests
      add constraint service_requests_deposit_payment_method_check
      check (
        deposit_payment_method is null
        or deposit_payment_method in ('cash', 'pix', 'card', 'mercado_pago_point', 'mercado_pago_link', 'other')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and conname = 'service_requests_balance_payment_method_check'
  ) then
    alter table public.service_requests
      add constraint service_requests_balance_payment_method_check
      check (
        balance_payment_method is null
        or balance_payment_method in ('cash', 'pix', 'card', 'mercado_pago_point', 'mercado_pago_link', 'other')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and conname = 'service_requests_refund_method_check'
  ) then
    alter table public.service_requests
      add constraint service_requests_refund_method_check
      check (
        refund_method is null
        or refund_method in ('cash', 'pix', 'card', 'mercado_pago_point', 'mercado_pago_link', 'other')
      ) not valid;
  end if;
end;
$$;

alter table public.service_requests
  validate constraint service_requests_payment_status_check;
alter table public.service_requests
  validate constraint service_requests_paid_amount_check;
alter table public.service_requests
  validate constraint service_requests_deposit_payment_method_check;
alter table public.service_requests
  validate constraint service_requests_balance_payment_method_check;
alter table public.service_requests
  validate constraint service_requests_refund_method_check;

create unique index if not exists audit_logs_service_request_operation_key_idx
  on public.audit_logs ((payload->>'operation_key'))
  where action = 'service_request_transition'
    and entity_type = 'service_request'
    and payload ? 'operation_key';

create or replace function public.staff_transition_service_request(
  target_request_id uuid,
  operation_key uuid,
  requested_action text,
  requested_deposit_fraction numeric default 0.5,
  requested_payment_method text default null,
  requested_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.service_requests%rowtype;
  existing_result jsonb;
  normalized_action text := lower(btrim(coalesce(requested_action, '')));
  normalized_payment_method text := nullif(lower(btrim(coalesce(requested_payment_method, ''))), '');
  normalized_note text := btrim(coalesce(requested_note, ''));
  previous_status text;
  backend_total numeric(16,2);
  pricing_status text;
  calculated_deposit numeric(16,2);
  result jsonb;
  refund_required boolean := false;
begin
  if actor_id is null then
    raise exception 'Sessão operacional obrigatória';
  end if;
  if target_request_id is null then
    raise exception 'Encomenda obrigatória';
  end if;
  if operation_key is null then
    raise exception 'Chave idempotente obrigatória';
  end if;
  if normalized_action not in (
    'send_quote',
    'request_deposit',
    'confirm_deposit',
    'confirm_order',
    'confirm_payment',
    'start_production',
    'mark_ready',
    'complete',
    'cancel',
    'confirm_refund'
  ) then
    raise exception 'Ação de encomenda inválida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('service-request-operation:' || operation_key::text, 0)
  );

  select audit.payload->'result'
  into existing_result
  from public.audit_logs audit
  where audit.action = 'service_request_transition'
    and audit.entity_type = 'service_request'
    and audit.payload->>'operation_key' = operation_key::text
  order by audit.id desc
  limit 1;

  if existing_result is not null then
    return existing_result || jsonb_build_object('idempotent', true);
  end if;

  select request.*
  into request_row
  from public.service_requests request
  where request.id = target_request_id
  for update;

  if request_row.id is null then
    raise exception 'Encomenda não encontrada';
  end if;
  if request_row.store_id is null then
    raise exception 'Encomenda sem loja responsável';
  end if;
  if not private.staff_has_capability(request_row.store_id, 'manage_orders') then
    raise exception 'Você não possui permissão para alterar encomendas desta loja';
  end if;

  if normalized_action in (
    'send_quote',
    'request_deposit',
    'confirm_deposit',
    'confirm_order',
    'confirm_payment',
    'confirm_refund'
  ) and not private.staff_has_capability(request_row.store_id, 'view_finance') then
    raise exception 'Ação financeira não autorizada para esta loja';
  end if;

  previous_status := request_row.status::text;

  select snapshot.total_price, snapshot.data_status
  into backend_total, pricing_status
  from public.service_request_pricing_snapshots snapshot
  where snapshot.request_id = request_row.id;

  if normalized_action in ('send_quote', 'request_deposit') then
    if backend_total is null or backend_total <= 0 then
      raise exception 'A encomenda não possui preço calculado pelo backend';
    end if;
    if pricing_status = 'blocked' then
      raise exception 'A precificação da encomenda está bloqueada';
    end if;
  end if;

  if normalized_payment_method is not null and normalized_payment_method not in (
    'cash', 'pix', 'card', 'mercado_pago_point', 'mercado_pago_link', 'other'
  ) then
    raise exception 'Forma de pagamento inválida';
  end if;

  if normalized_action = 'send_quote' then
    if previous_status not in ('prebooked', 'quoted') then
      raise exception 'Somente pré-reservas podem receber orçamento';
    end if;
    update public.service_requests
    set status = 'quoted',
        quoted_total = backend_total,
        quoted_at = now(),
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'request_deposit' then
    if previous_status not in ('prebooked', 'quoted', 'awaiting_deposit') then
      raise exception 'Não é possível solicitar sinal nesta situação';
    end if;
    if requested_deposit_fraction is null
       or requested_deposit_fraction < 0.05
       or requested_deposit_fraction > 1 then
      raise exception 'Percentual do sinal deve ficar entre 5% e 100%';
    end if;
    calculated_deposit := round(backend_total * requested_deposit_fraction, 2);
    if calculated_deposit <= 0 then
      raise exception 'O sinal calculado pelo backend deve ser positivo';
    end if;
    update public.service_requests
    set status = 'awaiting_deposit',
        quoted_total = backend_total,
        quoted_at = coalesce(quoted_at, now()),
        deposit_amount = calculated_deposit,
        deposit_paid_at = null,
        deposit_payment_method = null,
        deposit_confirmed_by = null,
        payment_status = 'pending',
        paid_amount = 0,
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'confirm_deposit' then
    if previous_status <> 'awaiting_deposit' then
      raise exception 'Somente encomendas aguardando sinal podem confirmar o recebimento';
    end if;
    if coalesce(request_row.deposit_amount, 0) <= 0 then
      raise exception 'A encomenda não possui sinal calculado';
    end if;
    if normalized_payment_method is null then
      raise exception 'Informe a forma de pagamento do sinal';
    end if;
    update public.service_requests
    set status = 'confirmed',
        deposit_paid_at = now(),
        deposit_payment_method = normalized_payment_method,
        deposit_confirmed_by = actor_id,
        paid_amount = deposit_amount,
        payment_status = case
          when quoted_total is not null and deposit_amount >= quoted_total then 'paid'
          else 'partial'
        end,
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'confirm_order' then
    if previous_status not in ('prebooked', 'quoted', 'awaiting_deposit') then
      raise exception 'Não é possível confirmar esta encomenda por contingência';
    end if;
    if char_length(normalized_note) < 8 then
      raise exception 'Informe o motivo da confirmação sem sinal';
    end if;
    update public.service_requests
    set status = 'confirmed',
        quoted_total = coalesce(quoted_total, backend_total),
        quoted_at = case when coalesce(quoted_total, backend_total) is not null then coalesce(quoted_at, now()) else quoted_at end,
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'confirm_payment' then
    if previous_status not in ('confirmed', 'in_production', 'ready') then
      raise exception 'O pagamento final só pode ser confirmado em encomenda ativa confirmada';
    end if;
    if coalesce(request_row.quoted_total, backend_total, 0) <= 0 then
      raise exception 'A encomenda não possui total calculado pelo backend';
    end if;
    if normalized_payment_method is null then
      raise exception 'Informe a forma de pagamento final';
    end if;
    update public.service_requests
    set quoted_total = coalesce(quoted_total, backend_total),
        paid_amount = coalesce(quoted_total, backend_total),
        payment_status = 'paid',
        balance_paid_at = now(),
        balance_payment_method = normalized_payment_method,
        payment_confirmed_by = actor_id,
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'start_production' then
    if previous_status <> 'confirmed' then
      raise exception 'Somente encomendas confirmadas podem entrar em produção';
    end if;
    update public.service_requests
    set status = 'in_production',
        production_started_at = coalesce(production_started_at, now()),
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'mark_ready' then
    if previous_status <> 'in_production' then
      raise exception 'Somente encomendas em produção podem ficar prontas';
    end if;
    update public.service_requests
    set status = 'ready',
        ready_at = coalesce(ready_at, now()),
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'complete' then
    if previous_status <> 'ready' then
      raise exception 'Somente encomendas prontas podem ser concluídas';
    end if;
    if request_row.payment_status <> 'paid' then
      raise exception 'Confirme o pagamento antes de concluir a encomenda';
    end if;
    update public.service_requests
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'cancel' then
    if previous_status not in (
      'prebooked', 'quoted', 'awaiting_deposit', 'confirmed', 'in_production', 'ready'
    ) then
      raise exception 'Esta encomenda não pode mais ser cancelada';
    end if;
    if char_length(normalized_note) < 8 then
      raise exception 'Informe o motivo do cancelamento';
    end if;
    refund_required := coalesce(request_row.paid_amount, 0) > 0;
    update public.service_requests
    set status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = actor_id,
        cancellation_reason = normalized_note,
        payment_status = case when refund_required then 'refund_pending' else payment_status end,
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;

  elsif normalized_action = 'confirm_refund' then
    if previous_status <> 'cancelled' or request_row.payment_status <> 'refund_pending' then
      raise exception 'Não existe estorno pendente para esta encomenda';
    end if;
    if normalized_payment_method is null then
      raise exception 'Informe a forma utilizada no estorno';
    end if;
    update public.service_requests
    set payment_status = 'refunded',
        refunded_at = now(),
        refund_method = normalized_payment_method,
        refund_confirmed_by = actor_id,
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;
  end if;

  if normalized_note <> '' and normalized_action <> 'cancel' then
    update public.service_requests
    set internal_notes = concat_ws(
          E'\n',
          nullif(internal_notes, ''),
          '[' || to_char(now() at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI') || '] ' || normalized_note
        )
    where id = request_row.id;
  end if;

  select request.*
  into request_row
  from public.service_requests request
  where request.id = target_request_id;

  result := jsonb_build_object(
    'request_id', request_row.id,
    'request_number', request_row.request_number,
    'store_id', request_row.store_id,
    'action', normalized_action,
    'previous_status', previous_status,
    'status', request_row.status,
    'quoted_total', request_row.quoted_total,
    'deposit_amount', request_row.deposit_amount,
    'deposit_paid_at', request_row.deposit_paid_at,
    'deposit_payment_method', request_row.deposit_payment_method,
    'payment_status', request_row.payment_status,
    'paid_amount', request_row.paid_amount,
    'balance_paid_at', request_row.balance_paid_at,
    'balance_payment_method', request_row.balance_payment_method,
    'production_started_at', request_row.production_started_at,
    'ready_at', request_row.ready_at,
    'completed_at', request_row.completed_at,
    'cancelled_at', request_row.cancelled_at,
    'cancellation_reason', request_row.cancellation_reason,
    'refunded_at', request_row.refunded_at,
    'refund_method', request_row.refund_method,
    'refund_required', request_row.payment_status = 'refund_pending',
    'idempotent', false
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, payload)
  values (
    actor_id,
    'service_request_transition',
    'service_request',
    request_row.id::text,
    jsonb_build_object(
      'operation_key', operation_key,
      'store_id', request_row.store_id,
      'requested_action', normalized_action,
      'previous_status', previous_status,
      'new_status', request_row.status,
      'payment_status', request_row.payment_status,
      'paid_amount', request_row.paid_amount,
      'result', result
    )
  );

  return result;
end;
$$;

revoke all on function public.staff_transition_service_request(uuid,uuid,text,numeric,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_transition_service_request(uuid,uuid,text,numeric,text,text)
  to authenticated;

comment on function public.staff_transition_service_request(uuid,uuid,text,numeric,text,text) is
  'Executa transições idempotentes de orçamento, sinal, pagamento, produção, prontidão, conclusão, cancelamento e estorno com escopo de loja e auditoria.';

do $$
declare
  lifecycle_routine regprocedure := to_regprocedure(
    'public.staff_transition_service_request(uuid,uuid,text,numeric,text,text)'
  );
  definition text;
  missing_columns text[];
begin
  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from unnest(array[
    'payment_status',
    'paid_amount',
    'production_started_at',
    'ready_at',
    'completed_at',
    'cancelled_at',
    'refunded_at',
    'last_action_at'
  ]) required(column_name)
  where not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'service_requests'
      and column_info.column_name = required.column_name
  );

  if coalesce(cardinality(missing_columns), 0) > 0 then
    raise exception 'Lifecycle columns are missing from service_requests: %', missing_columns;
  end if;

  if lifecycle_routine is null then
    raise exception 'staff_transition_service_request was not created';
  end if;
  if has_function_privilege('anon', lifecycle_routine, 'EXECUTE') then
    raise exception 'staff_transition_service_request remains executable by anon';
  end if;
  if not has_function_privilege('authenticated', lifecycle_routine, 'EXECUTE') then
    raise exception 'Authenticated BFF lost the service-request lifecycle RPC';
  end if;
  if to_regclass('public.audit_logs_service_request_operation_key_idx') is null then
    raise exception 'Service-request lifecycle idempotency index is missing';
  end if;

  select pg_get_functiondef(lifecycle_routine::oid) into definition;
  if position('for update' in lower(definition)) = 0
     or position('private.staff_has_capability(request_row.store_id, ''manage_orders'')' in definition) = 0
     or position('private.staff_has_capability(request_row.store_id, ''view_finance'')' in definition) = 0
     or position('public.service_request_pricing_snapshots' in definition) = 0
     or position('service_request_transition' in definition) = 0
     or position('operation_key' in definition) = 0 then
    raise exception 'Service-request lifecycle lost locking, authorization, backend pricing, audit or idempotency';
  end if;
end;
$$;

commit;
