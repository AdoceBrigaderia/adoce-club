-- Conclusão operacional e quitação financeira são eventos independentes.
-- Desconto em folha sempre identifica a pessoa responsável.

create table if not exists private.cash_payroll_charges (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.instant_orders(id) on delete restrict,
  cash_movement_id uuid references public.cash_movements(id) on delete restrict,
  payroll_employee_id uuid not null references public.staff_private_profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  operation_key uuid not null,
  created_by uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  unique (operation_key, payroll_employee_id)
);
alter table private.cash_payroll_charges enable row level security;
revoke all on private.cash_payroll_charges from public, anon, authenticated;

create or replace function public.staff_list_payroll_employees()
returns table(employee_id uuid, full_name text)
language sql security definer set search_path = '' stable as $$
  select employee.id, employee.full_name
  from public.staff_private_profiles employee
  where (select private.is_staff()) and employee.active
  order by employee.full_name;
$$;
revoke all on function public.staff_list_payroll_employees() from public, anon;
grant execute on function public.staff_list_payroll_employees() to authenticated;

create or replace function private.record_cash_payroll_charge(
  target_order_id uuid,
  requested_employee_id uuid,
  requested_operation_key uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare payroll_amount numeric(10,2); movement_id uuid;
begin
  select coalesce(sum((allocation->>'amount')::numeric),0)
    into payroll_amount
  from public.instant_orders orders,
       jsonb_array_elements(coalesce(orders.payment_allocations,'[]'::jsonb)) allocation
  where orders.id=target_order_id and allocation->>'method'='payroll';
  if payroll_amount <= 0 then return; end if;
  if requested_employee_id is null or not exists (
    select 1 from public.staff_private_profiles employee
    where employee.id=requested_employee_id and employee.active
  ) then raise exception 'Funcionário inválido para desconto em folha'; end if;
  select id into movement_id from public.cash_movements
  where order_id=target_order_id and payment_method_code='payroll'
  order by created_at desc limit 1;
  insert into private.cash_payroll_charges(order_id,cash_movement_id,payroll_employee_id,amount,operation_key,created_by)
  values(target_order_id,movement_id,requested_employee_id,payroll_amount,requested_operation_key,(select auth.uid()))
  on conflict (operation_key,payroll_employee_id) do nothing;
end;
$$;
revoke all on function private.record_cash_payroll_charge(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.staff_create_manual_sale_in_cash_v7(
  requested_operation_key uuid,target_session_id uuid,target_draft_key text,
  requested_customer_name text,requested_customer_phone text,requested_items jsonb,
  requested_payment_method text,requested_discount jsonb,requested_payments jsonb,
  requested_notes text default '',requested_change jsonb default '{}',
  requested_payroll_employee_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare response jsonb;
begin
  response:=public.staff_create_manual_sale_in_cash_v6(requested_operation_key,target_session_id,target_draft_key,
    requested_customer_name,requested_customer_phone,requested_items,requested_payment_method,
    requested_discount,requested_payments,requested_notes,requested_change);
  perform private.record_cash_payroll_charge((response->>'order_id')::uuid,requested_payroll_employee_id,requested_operation_key);
  return response;
end; $$;
revoke all on function public.staff_create_manual_sale_in_cash_v7(uuid,uuid,text,text,text,jsonb,text,jsonb,jsonb,text,jsonb,uuid) from public,anon;
grant execute on function public.staff_create_manual_sale_in_cash_v7(uuid,uuid,text,text,text,jsonb,text,jsonb,jsonb,text,jsonb,uuid) to authenticated;

create or replace function public.staff_complete_partial_cash_sale(
  requested_operation_key uuid,target_session_id uuid,target_draft_key text,
  requested_customer_name text,requested_customer_phone text,requested_items jsonb,
  requested_payment_method text,requested_discount jsonb,requested_payments jsonb,
  requested_notes text default '',requested_change jsonb default '{}',
  requested_payroll_employee_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare response jsonb; target public.instant_orders%rowtype;
begin
  if btrim(coalesce(requested_customer_name,'')) !~ '\\S{2,}' then
    raise exception 'Informe o nome do cliente para deixar o saldo pendente';
  end if;
  response:=public.staff_create_manual_sale_in_cash_v7(requested_operation_key,target_session_id,target_draft_key,
    requested_customer_name,requested_customer_phone,requested_items,requested_payment_method,
    requested_discount,requested_payments,requested_notes,requested_change,requested_payroll_employee_id);
  select * into target from public.instant_orders where id=(response->>'order_id')::uuid for update;
  if target.amount_paid <= 0 or target.amount_paid >= target.total then
    raise exception 'O pagamento parcial deve ser maior que zero e menor que o total';
  end if;
  -- v6 já concluiu a baixa física de estoque de forma atômica. Aqui somente
  -- restauramos o estado operacional concluído que v5 havia trocado para
  -- awaiting_payment ao detectar o saldo financeiro.
  update public.instant_orders set status='completed',completed_at=now(),payment_deferred=true,
    reserved_until=null,payment_expires_at=null,updated_at=now()
  where id=target.id returning * into target;
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
  values((select auth.uid()),'cash.partial_sale_completed','instant_order',target.id::text,
    jsonb_build_object('amount_paid',target.amount_paid,'remaining',target.total-target.amount_paid));
  return response || jsonb_build_object('completed',true,'remaining',target.total-target.amount_paid,'payment_deferred',true);
end; $$;
revoke all on function public.staff_complete_partial_cash_sale(uuid,uuid,text,text,text,jsonb,text,jsonb,jsonb,text,jsonb,uuid) from public,anon;
grant execute on function public.staff_complete_partial_cash_sale(uuid,uuid,text,text,text,jsonb,text,jsonb,jsonb,text,jsonb,uuid) to authenticated;

create table if not exists private.cash_deferred_receipt_requests(
  operation_key uuid primary key,
  actor_id uuid not null references auth.users(id),
  order_id uuid not null references public.instant_orders(id),
  response_payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.cash_deferred_receipt_requests enable row level security;
revoke all on private.cash_deferred_receipt_requests from public,anon,authenticated;

create or replace function public.staff_receive_deferred_cash_sale_v2(
  target_order_id uuid,target_session_id uuid,requested_method text,
  requested_amount numeric,requested_operation_key uuid,requested_payroll_employee_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare session_row public.cash_sessions%rowtype; target public.instant_orders%rowtype;
  actor uuid:=(select auth.uid()); remaining_amount numeric(10,2); received_amount numeric(10,2);
  response jsonb; movement_id uuid;
begin
  if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  select response_payload into response from private.cash_deferred_receipt_requests
    where operation_key=requested_operation_key and actor_id=actor;
  if response is not null then return response || jsonb_build_object('idempotent',true); end if;
  select * into session_row from public.cash_sessions where id=target_session_id and status='open' for update;
  if session_row.id is null or not private.can_access_store(session_row.store_id) then raise exception 'Abra um caixa autorizado para receber'; end if;
  select * into target from public.instant_orders where id=target_order_id and payment_deferred for update;
  if target.id is null or target.store_id<>session_row.store_id then raise exception 'Pendência não encontrada nesta loja'; end if;
  remaining_amount:=round(target.total-target.amount_paid,2);
  if requested_amount is null or requested_amount<=0 then raise exception 'Informe um valor válido'; end if;
  received_amount:=least(requested_amount, remaining_amount);
  if requested_method not in ('cash','pix','credit_card','debit_card','payroll')
     or not exists(select 1 from public.payment_methods where code=requested_method and active)
  then raise exception 'Meio de pagamento inválido'; end if;
  if requested_method='payroll' and (requested_payroll_employee_id is null or not exists(
    select 1 from public.staff_private_profiles where id=requested_payroll_employee_id and active
  )) then raise exception 'Funcionário inválido para desconto em folha'; end if;
  insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
  values(session_row.id,session_row.store_id,session_row.register_id,'sale','in',requested_method,received_amount,target.id,'Recebimento parcial de venda pendente',actor)
  returning id into movement_id;
  if requested_method='payroll' then
    insert into private.cash_payroll_charges(order_id,cash_movement_id,payroll_employee_id,amount,operation_key,created_by)
    values(target.id,movement_id,requested_payroll_employee_id,received_amount,requested_operation_key,actor);
  end if;
  update public.instant_orders set amount_paid=amount_paid+received_amount,
    payment_status=case when amount_paid+received_amount>=total then 'approved' else 'pending' end,
    payment_recorded_at=case when amount_paid+received_amount>=total then now() else payment_recorded_at end,
    paid_at=case when amount_paid+received_amount>=total then now() else paid_at end,
    payment_allocations=coalesce(payment_allocations,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('method',requested_method,'amount',received_amount,'cash_session_id',session_row.id)),
    updated_by=actor,updated_at=now() where id=target.id returning * into target;
  response:=jsonb_build_object('received',true,'amount',received_amount,'remaining',greatest(0,target.total-target.amount_paid),'paid',target.payment_status='approved');
  insert into private.cash_deferred_receipt_requests values(requested_operation_key,actor,target.id,response,now());
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
  values(actor,'cash.deferred_received','instant_order',target.id::text,response||jsonb_build_object('session_id',session_row.id,'method',requested_method));
  return response;
end; $$;
revoke all on function public.staff_receive_deferred_cash_sale_v2(uuid,uuid,text,numeric,uuid,uuid) from public,anon;
grant execute on function public.staff_receive_deferred_cash_sale_v2(uuid,uuid,text,numeric,uuid,uuid) to authenticated;

-- O carimbo nasce na conclusão operacional, mesmo com saldo financeiro aberto.
-- A função atual de fidelidade já chama staff_record_purchase antes de retornar;
-- este gatilho anota o pedido na entrada gerada, tornando a reversão rastreável.
create or replace function private.annotate_cash_loyalty_purchase()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.action='cash.customer_loyalty_finalized' then
    update public.instant_orders set status='completed',completed_at=coalesce(completed_at,now()),
      payment_deferred=(payment_status<>'approved'),reserved_until=null,payment_expires_at=null,updated_at=now()
    where id=new.entity_id::uuid;
    update public.ledger_entries entry set metadata=entry.metadata||jsonb_build_object('order_id',new.entity_id,'source','cash_operational_completion')
    where entry.idempotency_key in (
      select request.operation_key::text||':purchase' from private.cash_customer_loyalty_requests request
      where request.response_payload->>'order_id'=new.entity_id
    );
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values(new.actor_user_id,'cash.loyalty_stamps_granted','instant_order',new.entity_id,new.payload);
  end if;
  return new;
end; $$;
drop trigger if exists annotate_cash_loyalty_purchase on public.audit_events;
create trigger annotate_cash_loyalty_purchase after insert on public.audit_events
for each row when (new.action='cash.customer_loyalty_finalized') execute function private.annotate_cash_loyalty_purchase();

create or replace function public.staff_reverse_cash_sale_loyalty(target_order_id uuid,requested_reason text,requested_operation_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.ledger_entries%rowtype; track public.loyalty_tracks%rowtype;
  total_after integer; new_progress smallint; new_completed integer; reversed_id uuid;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_loyalty') then raise exception 'Acesso não autorizado'; end if;
  if char_length(btrim(coalesce(requested_reason,'')))<5 then raise exception 'Informe o motivo do estorno'; end if;
  select * into source from public.ledger_entries where metadata->>'order_id'=target_order_id::text and reason='purchase' for update;
  if source.id is null then raise exception 'Carimbos da venda não encontrados'; end if;
  if exists(select 1 from public.ledger_entries where related_entry_id=source.id and reason='reversal') then
    return jsonb_build_object('reversed',true,'idempotent',true);
  end if;
  select * into track from public.loyalty_tracks where id=source.track_id for update;
  total_after:=track.completed_cards*14+track.current_progress-source.stamps_delta;
  if total_after<0 then raise exception 'Saldo atual insuficiente para o estorno automático'; end if;
  new_completed:=total_after/14; new_progress:=(total_after%14)::smallint;
  if exists(select 1 from public.rewards where track_id=track.id and source_cycle>new_completed and status='redeemed') then
    raise exception 'O estorno alcança prêmio já resgatado';
  end if;
  update public.rewards set status='reversed',reversed_at=now()
  where track_id=track.id and source_cycle>new_completed and status='available';
  update public.loyalty_tracks set current_progress=new_progress,completed_cards=new_completed,updated_at=now() where id=track.id;
  insert into public.ledger_entries(track_id,subject_profile_id,actor_user_id,reason,stamps_delta,resulting_progress,resulting_completed_cards,idempotency_key,related_entry_id,metadata)
  values(track.id,source.subject_profile_id,(select auth.uid()),'reversal',-source.stamps_delta,new_progress,new_completed,requested_operation_key::text,source.id,
    jsonb_build_object('order_id',target_order_id,'reason',btrim(requested_reason),'source','cash_sale_cancellation')) returning id into reversed_id;
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
  values((select auth.uid()),'cash.loyalty_stamps_reversed','instant_order',target_order_id::text,jsonb_build_object('source_ledger_id',source.id,'reversal_ledger_id',reversed_id,'quantity',source.stamps_delta,'reason',btrim(requested_reason)));
  return jsonb_build_object('reversed',true,'quantity',source.stamps_delta,'ledger_entry_id',reversed_id);
end; $$;
revoke all on function public.staff_reverse_cash_sale_loyalty(uuid,text,uuid) from public,anon;
grant execute on function public.staff_reverse_cash_sale_loyalty(uuid,text,uuid) to authenticated;
