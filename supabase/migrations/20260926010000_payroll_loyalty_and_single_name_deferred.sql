-- Ajustes do Caixa pedidos em 25/09/2026:
-- 1. Nova forma "Desconto em folha" (funcionários; não entra dinheiro no caixa).
-- 2. Fidelidade do cartão de papel: fatia premiada para cliente fora do sistema,
--    com baixa de estoque e contada como cortesia (is_reward).
-- 3. Pagamento pendente aceita só o primeiro nome (antes exigia nome e sobrenome).

insert into public.payment_methods(code, label, fee_percent, fee_fixed, active, customer_selectable, sort_order)
values ('payroll', 'Desconto em folha', 0, 0, true, false, 50)
on conflict (code) do update set label = excluded.label, active = true, customer_selectable = false;

create or replace function public.staff_create_deferred_cash_sale(target_session_id uuid, target_draft_key text, requested_operation_key uuid, requested_customer_name text, requested_items jsonb, requested_discount jsonb DEFAULT '{}'::jsonb, requested_notes text DEFAULT ''::text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s public.cash_sessions%rowtype; o public.instant_orders%rowtype; actor uuid:=auth.uid(); old_id uuid;
 subtotal numeric; discount numeric; conflicts jsonb; line jsonb; choice jsonb; item_id uuid;
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
 if requested_operation_key is null or btrim(coalesce(requested_customer_name,'')) !~ '\S{2,}' then raise exception 'Informe o nome do cliente'; end if;
 perform pg_advisory_xact_lock(hashtextextended('deferred:'||requested_operation_key::text,0));
 select order_id into old_id from private.cash_deferred_requests where operation_key=requested_operation_key and actor_id=actor;
 if old_id is not null then select * into o from public.instant_orders where id=old_id;
  return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'remaining',o.total-o.amount_paid,'idempotent',true); end if;
 select * into s from public.cash_sessions where id=target_session_id and status='open' for update;
 if s.id is null or not private.can_access_store(s.store_id) then raise exception 'Abra um caixa autorizado'; end if;
 if jsonb_typeof(requested_items) is distinct from 'array' or jsonb_array_length(requested_items)=0 then raise exception 'Inclua fatias'; end if;
 if exists(select 1 from jsonb_array_elements(requested_items) x left join public.flavors f on f.id=(x->>'flavor_id')::uuid where f.id is null or not f.active or (x->>'quantity')::numeric is null or (x->>'quantity')::numeric<>trunc((x->>'quantity')::numeric) or (x->>'quantity')::int not between 1 and 60) then raise exception 'Itens inválidos'; end if;
 select sum(f.base_price*(x->>'quantity')::int) into subtotal from jsonb_array_elements(requested_items) x join public.flavors f on f.id=(x->>'flavor_id')::uuid;
 discount:=least(subtotal,greatest(0,case when requested_discount->>'kind'='percent' then round(subtotal*coalesce((requested_discount->>'value')::numeric,0)/100,2) when requested_discount->>'kind'='amount' then coalesce((requested_discount->>'value')::numeric,0) else 0 end));
 if subtotal-discount<=0 then raise exception 'Venda sem saldo deve ser finalizada normalmente'; end if;
 perform public.staff_release_cash_draft_reservation(s.id,target_draft_key);
 insert into public.instant_orders(order_number,public_token_hash,customer_name,customer_phone,status,checkout_mode,subtotal,total,gross_amount,net_amount,sales_channel,internal_notes,created_by,updated_by,store_id,cash_register_id,cash_session_id,payment_deferred,payment_status,discount_amount)
 values('',private.instant_order_hash(encode(extensions.gen_random_bytes(24),'hex')),btrim(requested_customer_name),'+5500000000000','awaiting_confirmation','staff_confirmation',subtotal,subtotal-discount,subtotal-discount,subtotal-discount,'operation',left(requested_notes,2000),actor,actor,s.store_id,s.register_id,s.id,true,'pending',discount) returning * into o;
 for line in select * from jsonb_array_elements(requested_items) loop
  insert into public.instant_order_items(order_id,flavor_id,flavor_name,unit_price,quantity,status)
  select o.id,id,name,base_price,(line->>'quantity')::int,'selected' from public.flavors where id=(line->>'flavor_id')::uuid returning id into item_id;
  for choice in select * from jsonb_array_elements(coalesce(line->'sauces','[]')) loop
   if nullif(choice->>'sauce_id','') is not null then
    insert into public.instant_order_item_sauces(order_item_id,unit_number,sauce_id,sauce_name) select item_id,(choice->>'unit_number')::int,id,name from public.order_sauces where id=(choice->>'sauce_id')::uuid and active;
   end if;
  end loop;
 end loop;
 conflicts:=private.reserve_instant_order_stock(o.id);
 if jsonb_array_length(conflicts)>0 then raise exception 'Estoque insuficiente'; end if;
 perform private.refresh_instant_order_stock_for_payment(o.id);
 update public.flavor_availability a set quantity_available=a.quantity_available-r.quantity,updated_at=now()
 from (select flavor_id,stock_service_date,sum(quantity)::int quantity from public.instant_order_items where order_id=o.id and status='reserved' group by 1,2) r
 where a.flavor_id=r.flavor_id and a.service_date=r.stock_service_date;
 update public.instant_order_items set status='paid',updated_at=now() where order_id=o.id and status='reserved';
 update public.instant_orders set status='completed',completed_at=now(),reserved_until=null,payment_expires_at=null,updated_at=now() where id=o.id;
 insert into private.cash_deferred_requests values(requested_operation_key,actor,o.id);
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload) values(actor,'cash.deferred_sale','instant_order',o.id::text,jsonb_build_object('total',o.total));
 return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'remaining',o.total,'completed',true);
end; $function$;

-- Fidelidade do cartão de papel. Cada fatia vira item premiado (is_reward).
-- Sabor acima de R$ 16 paga só a diferença, igual à regra do Clube.
create table if not exists private.cash_loyalty_requests(
  operation_key uuid not null, actor_id uuid not null, order_id uuid not null,
  primary key (operation_key, actor_id));

create or replace function public.staff_create_loyalty_cash_sale(target_session_id uuid, target_draft_key text, requested_operation_key uuid, requested_customer_name text, requested_items jsonb, requested_payment_method text default null, requested_notes text default '')
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s public.cash_sessions%rowtype; o public.instant_orders%rowtype; actor uuid:=auth.uid(); old_id uuid;
 charge numeric; conflicts jsonb; line jsonb; choice jsonb; item_id uuid; who text := btrim(coalesce(requested_customer_name,''));
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
 if requested_operation_key is null then raise exception 'Chave de operação inválida'; end if;
 if char_length(who) < 2 then who := 'Fidelidade (cartão)'; end if;
 perform pg_advisory_xact_lock(hashtextextended('loyalty:'||requested_operation_key::text,0));
 select order_id into old_id from private.cash_loyalty_requests where operation_key=requested_operation_key and actor_id=actor;
 if old_id is not null then select * into o from public.instant_orders where id=old_id;
  return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'total',o.total,'idempotent',true); end if;
 select * into s from public.cash_sessions where id=target_session_id and status='open' for update;
 if s.id is null or not private.can_access_store(s.store_id) then raise exception 'Abra um caixa autorizado'; end if;
 if jsonb_typeof(requested_items) is distinct from 'array' or jsonb_array_length(requested_items)=0 then raise exception 'Inclua fatias'; end if;
 if exists(select 1 from jsonb_array_elements(requested_items) x left join public.flavors f on f.id=(x->>'flavor_id')::uuid where f.id is null or not f.active or (x->>'quantity')::numeric is null or (x->>'quantity')::numeric<>trunc((x->>'quantity')::numeric) or (x->>'quantity')::int not between 1 and 30) then raise exception 'Itens inválidos'; end if;
 select coalesce(sum(greatest(f.base_price-16,0)*(x->>'quantity')::int),0) into charge from jsonb_array_elements(requested_items) x join public.flavors f on f.id=(x->>'flavor_id')::uuid;
 if charge > 0 and not exists(select 1 from public.payment_methods p where p.code=requested_payment_method and p.active) then
   raise exception 'Informe como o cliente pagou a diferença de R$ %', to_char(charge,'FM999990D00'); end if;
 perform public.staff_release_cash_draft_reservation(s.id,target_draft_key);
 insert into public.instant_orders(order_number,public_token_hash,customer_name,customer_phone,status,checkout_mode,subtotal,total,gross_amount,net_amount,sales_channel,internal_notes,created_by,updated_by,store_id,cash_register_id,cash_session_id,payment_status,amount_paid,payment_method_code)
 values('',private.instant_order_hash(encode(extensions.gen_random_bytes(24),'hex')),left(who,120),'+5500000000000','awaiting_confirmation','staff_confirmation',charge,charge,charge,charge,'operation',left(btrim('Fidelidade (cartão de papel). '||coalesce(requested_notes,'')),2000),actor,actor,s.store_id,s.register_id,s.id,'pending',0,case when charge>0 then requested_payment_method end) returning * into o;
 for line in select * from jsonb_array_elements(requested_items) loop
  insert into public.instant_order_items(order_id,flavor_id,flavor_name,unit_price,quantity,status,is_reward)
  select o.id,id,name,greatest(base_price-16,0),(line->>'quantity')::int,'selected',true from public.flavors where id=(line->>'flavor_id')::uuid returning id into item_id;
  for choice in select * from jsonb_array_elements(coalesce(line->'sauces','[]')) loop
   if nullif(choice->>'sauce_id','') is not null then
    insert into public.instant_order_item_sauces(order_item_id,unit_number,sauce_id,sauce_name) select item_id,(choice->>'unit_number')::int,id,name from public.order_sauces where id=(choice->>'sauce_id')::uuid and active;
   end if;
  end loop;
 end loop;
 conflicts:=private.reserve_instant_order_stock(o.id);
 if jsonb_array_length(conflicts)>0 then raise exception 'Estoque insuficiente'; end if;
 perform private.refresh_instant_order_stock_for_payment(o.id);
 update public.flavor_availability a set quantity_available=a.quantity_available-r.quantity,updated_at=now()
 from (select flavor_id,stock_service_date,sum(quantity)::int quantity from public.instant_order_items where order_id=o.id and status='reserved' group by 1,2) r
 where a.flavor_id=r.flavor_id and a.service_date=r.stock_service_date;
 update public.instant_order_items set status='paid',updated_at=now() where order_id=o.id and status='reserved';
 if charge > 0 then
  insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
  values(s.id,s.store_id,s.register_id,'sale','in',requested_payment_method,charge,o.id,'Diferença da fidelidade',actor);
 end if;
 update public.instant_orders set status='completed',completed_at=now(),payment_status='approved',amount_paid=charge,payment_recorded_at=now(),
   payment_allocations=case when charge>0 then jsonb_build_array(jsonb_build_object('method',requested_payment_method,'amount',charge)) else '[]'::jsonb end,
   reserved_until=null,payment_expires_at=null,updated_at=now() where id=o.id returning * into o;
 insert into private.cash_loyalty_requests values(requested_operation_key,actor,o.id);
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload) values(actor,'cash.paper_loyalty_sale','instant_order',o.id::text,jsonb_build_object('total',o.total,'items',requested_items));
 return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'total',o.total,'completed',true);
end; $function$;
revoke all on function public.staff_create_loyalty_cash_sale(uuid,text,uuid,text,jsonb,text,text) from public, anon;
grant execute on function public.staff_create_loyalty_cash_sale(uuid,text,uuid,text,jsonb,text,text) to authenticated;

-- A trava "pagamento antes de concluir" também exigia nome e sobrenome na venda pendente.
create or replace function private.enforce_instant_order_payment_before_ready()
 returns trigger language plpgsql security definer set search_path to '' as $function$
begin
 if new.status in ('ready','completed') and new.payment_status is distinct from 'approved'
 and not (new.payment_deferred and new.sales_channel='operation' and new.cash_session_id is not null
   and new.customer_name ~ '\S{2,}') then
  raise exception 'Confirme o pagamento antes de marcar o pedido como pronto ou entregue';
 end if;
 return new;
end; $function$;

-- Pendência pode ser quitada também por desconto em folha.
create or replace function public.staff_receive_deferred_cash_sale(target_order_id uuid, target_session_id uuid, requested_method text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s public.cash_sessions%rowtype; o public.instant_orders%rowtype; amount numeric; actor uuid:=auth.uid();
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
 select * into s from public.cash_sessions where id=target_session_id and status='open' for update;
 if s.id is null or not private.can_access_store(s.store_id) then raise exception 'Abra um caixa autorizado para receber'; end if;
 select * into o from public.instant_orders where id=target_order_id and payment_deferred for update;
 if o.id is null or o.store_id<>s.store_id then raise exception 'Pendência não encontrada nesta loja'; end if;
 if o.payment_status='approved' then return jsonb_build_object('received',true,'already_received',true); end if;
 if requested_method not in ('cash','pix','credit_card','debit_card','payroll') or not exists(select 1 from public.payment_methods where code=requested_method and active) then raise exception 'Meio de pagamento inválido'; end if;
 amount:=o.total-o.amount_paid;
 if amount<=0 then raise exception 'Saldo inválido'; end if;
 insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
 values(s.id,s.store_id,s.register_id,'sale','in',requested_method,amount,o.id,'Recebimento de venda com pagamento pendente',actor);
 perform private.snapshot_instant_order_payment(o.id,requested_method);
 update public.instant_orders set payment_status='approved',amount_paid=total,payment_recorded_at=now(),paid_at=now(),payment_allocations=payment_allocations||jsonb_build_array(jsonb_build_object('method',requested_method,'amount',amount,'cash_session_id',s.id)),updated_by=actor,updated_at=now() where id=o.id;
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload) values(actor,'cash.deferred_received','instant_order',o.id::text,jsonb_build_object('amount',amount,'session_id',s.id,'method',requested_method));
 return jsonb_build_object('received',true,'amount',amount);
end; $function$;
