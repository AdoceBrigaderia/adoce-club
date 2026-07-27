begin;

create table if not exists public.cash_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.instant_orders(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  payment_method_code text not null references public.payment_methods(code) on update cascade on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'reconciled', 'cancelled')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  idempotency_key text not null unique check (char_length(idempotency_key) between 12 and 180),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reconciled_cash_session_id uuid references public.cash_sessions(id) on delete restrict,
  reconciled_by uuid references auth.users(id) on delete restrict,
  reconciled_at timestamptz,
  reconciliation_notes text not null default '',
  reconciliation_operation_key text,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and reconciled_at is null and cancelled_at is null)
    or (status = 'reconciled' and reconciled_at is not null and reconciled_cash_session_id is not null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create index if not exists cash_reconciliation_queue_store_status_idx
  on public.cash_reconciliation_queue(store_id, status, created_at desc);
create unique index if not exists cash_reconciliation_queue_reconcile_key_idx
  on public.cash_reconciliation_queue(reconciliation_operation_key)
  where reconciliation_operation_key is not null;

alter table public.cash_reconciliation_queue enable row level security;
revoke all on table public.cash_reconciliation_queue from anon, authenticated;

drop trigger if exists cash_reconciliation_queue_touch_updated_at on public.cash_reconciliation_queue;
create trigger cash_reconciliation_queue_touch_updated_at
before update on public.cash_reconciliation_queue
for each row execute function private.touch_updated_at();

create or replace function public.manager_create_manual_sale_for_reconciliation(
  target_store_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_payment_method text,
  operation_key text,
  requested_notes text default '',
  reconciliation_reason text default 'Venda nao lancada na hora'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_result jsonb;
  target_order public.instant_orders%rowtype;
  target_queue public.cash_reconciliation_queue%rowtype;
  existing_queue public.cash_reconciliation_queue%rowtype;
  existing_order public.instant_orders%rowtype;
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Apenas proprietarios e gestores podem registrar venda em contingencia';
  end if;
  if operation_key is null or char_length(operation_key) < 12 then
    raise exception 'Chave de idempotencia invalida';
  end if;
  if char_length(btrim(coalesce(reconciliation_reason, ''))) < 3 then
    raise exception 'Informe o motivo da contingencia';
  end if;
  if not exists(select 1 from public.stores s where s.id = target_store_id and s.active) then
    raise exception 'Loja ativa nao encontrada';
  end if;

  select * into existing_queue
  from public.cash_reconciliation_queue q
  where q.idempotency_key = operation_key;
  if existing_queue.id is not null then
    select * into existing_order from public.instant_orders where id = existing_queue.order_id;
    return jsonb_build_object(
      'reconciliation_id', existing_queue.id,
      'order_id', existing_queue.order_id,
      'order_number', existing_order.order_number,
      'status', existing_queue.status,
      'amount', existing_queue.amount,
      'idempotent', true
    );
  end if;

  sale_result := public.staff_create_manual_sale(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_payment_method,
    requested_notes
  );

  select * into target_order
  from public.instant_orders
  where id = nullif(sale_result ->> 'order_id', '')::uuid
  for update;
  if target_order.id is null then
    raise exception 'A venda foi criada sem identificacao do pedido';
  end if;

  update public.instant_orders
  set store_id = target_store_id,
      cash_register_id = null,
      cash_session_id = null,
      internal_notes = left(concat_ws(E'\n', nullif(internal_notes, ''), '[CONTINGENCIA] ' || btrim(reconciliation_reason)), 4000),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = target_order.id
  returning * into target_order;

  insert into public.cash_reconciliation_queue(
    order_id, store_id, payment_method_code, amount, reason,
    idempotency_key, created_by
  ) values (
    target_order.id,
    target_store_id,
    coalesce(target_order.payment_method_code, requested_payment_method),
    target_order.total,
    left(btrim(reconciliation_reason), 500),
    operation_key,
    (select auth.uid())
  ) returning * into target_queue;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'cash_reconciliation.created',
    'instant_order',
    target_order.id::text,
    jsonb_build_object(
      'reconciliation_id', target_queue.id,
      'store_id', target_store_id,
      'amount', target_queue.amount,
      'payment_method_code', target_queue.payment_method_code,
      'reason', target_queue.reason
    )
  );

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values (
    'cash.reconciliation.created',
    'instant_order',
    target_order.id,
    jsonb_build_object('reconciliation_id', target_queue.id, 'store_id', target_store_id)
  );

  return sale_result || jsonb_build_object(
    'reconciliation_id', target_queue.id,
    'status', target_queue.status,
    'amount', target_queue.amount,
    'store_id', target_store_id,
    'cash_movement_recorded', false,
    'requires_reconciliation', true
  );
end;
$$;

create or replace function public.staff_get_cash_reconciliation_queue(
  target_store_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Apenas proprietarios e gestores podem consultar reconciliacoes';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'order_id', q.order_id,
      'order_number', o.order_number,
      'store_id', q.store_id,
      'store_name', s.name,
      'payment_method_code', q.payment_method_code,
      'payment_method_label', coalesce(p.label, q.payment_method_code),
      'amount', q.amount,
      'status', q.status,
      'reason', q.reason,
      'created_by', q.created_by,
      'created_by_name', coalesce(profile.full_name, 'Gestor'),
      'created_at', q.created_at,
      'customer_name', o.customer_name,
      'customer_phone', o.customer_phone
    ) order by q.created_at asc)
    from public.cash_reconciliation_queue q
    join public.instant_orders o on o.id = q.order_id
    join public.stores s on s.id = q.store_id
    left join public.payment_methods p on p.code = q.payment_method_code
    left join public.profiles profile on profile.id = q.created_by
    where q.status = 'pending'
      and (target_store_id is null or q.store_id = target_store_id)
      and private.can_access_store(q.store_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.manager_reconcile_cash_sale(
  target_reconciliation_id uuid,
  target_session_id uuid,
  operation_key text,
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  queue_record public.cash_reconciliation_queue%rowtype;
  session_record public.cash_sessions%rowtype;
  order_record public.instant_orders%rowtype;
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Apenas proprietarios e gestores podem reconciliar vendas';
  end if;
  if operation_key is null or char_length(operation_key) < 12 then
    raise exception 'Chave de idempotencia invalida';
  end if;

  select * into queue_record
  from public.cash_reconciliation_queue
  where id = target_reconciliation_id
  for update;
  if queue_record.id is null then
    raise exception 'Venda pendente de reconciliacao nao encontrada';
  end if;
  if queue_record.status = 'reconciled'
     and queue_record.reconciliation_operation_key = operation_key then
    select * into order_record from public.instant_orders where id = queue_record.order_id;
    return jsonb_build_object(
      'reconciliation_id', queue_record.id,
      'order_id', queue_record.order_id,
      'order_number', order_record.order_number,
      'status', queue_record.status,
      'cash_session_id', queue_record.reconciled_cash_session_id,
      'idempotent', true
    );
  end if;
  if queue_record.status <> 'pending' then
    raise exception 'Esta venda nao esta mais pendente';
  end if;

  select * into session_record
  from public.cash_sessions
  where id = target_session_id and status = 'open'
  for update;
  if session_record.id is null then
    raise exception 'Abra um caixa antes de reconciliar a venda';
  end if;
  if session_record.store_id <> queue_record.store_id then
    raise exception 'O caixa aberto pertence a outra loja';
  end if;

  perform public.staff_record_cash_movement(
    session_record.id,
    'sale',
    queue_record.payment_method_code,
    queue_record.amount,
    left(concat('Reconciliacao da venda ', queue_record.order_id::text, case when btrim(coalesce(next_notes, '')) <> '' then ' · ' || btrim(next_notes) else '' end), 1000),
    queue_record.order_id
  );

  update public.cash_reconciliation_queue
  set status = 'reconciled',
      reconciled_cash_session_id = session_record.id,
      reconciled_by = (select auth.uid()),
      reconciled_at = now(),
      reconciliation_notes = left(btrim(coalesce(next_notes, '')), 1000),
      reconciliation_operation_key = operation_key,
      updated_at = now()
  where id = queue_record.id
  returning * into queue_record;

  select * into order_record from public.instant_orders where id = queue_record.order_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'cash_reconciliation.reconciled',
    'instant_order',
    queue_record.order_id::text,
    jsonb_build_object(
      'reconciliation_id', queue_record.id,
      'cash_session_id', session_record.id,
      'store_id', queue_record.store_id,
      'amount', queue_record.amount,
      'payment_method_code', queue_record.payment_method_code
    )
  );

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values (
    'cash.reconciliation.completed',
    'instant_order',
    queue_record.order_id,
    jsonb_build_object('reconciliation_id', queue_record.id, 'cash_session_id', session_record.id)
  );

  return jsonb_build_object(
    'reconciliation_id', queue_record.id,
    'order_id', queue_record.order_id,
    'order_number', order_record.order_number,
    'status', queue_record.status,
    'cash_session_id', session_record.id,
    'amount', queue_record.amount,
    'cash_movement_recorded', true
  );
end;
$$;

revoke all on function public.manager_create_manual_sale_for_reconciliation(uuid,text,text,jsonb,text,text,text,text) from public, anon;
revoke all on function public.staff_get_cash_reconciliation_queue(uuid) from public, anon;
revoke all on function public.manager_reconcile_cash_sale(uuid,uuid,text,text) from public, anon;
grant execute on function public.manager_create_manual_sale_for_reconciliation(uuid,text,text,jsonb,text,text,text,text) to authenticated;
grant execute on function public.staff_get_cash_reconciliation_queue(uuid) to authenticated;
grant execute on function public.manager_reconcile_cash_sale(uuid,uuid,text,text) to authenticated;

commit;
