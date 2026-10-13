-- Venda concluída e recebimento são eventos independentes.
alter table public.instant_orders add column if not exists payment_deferred boolean not null default false;
create table if not exists private.cash_deferred_requests (
 operation_key uuid primary key, actor_id uuid not null, order_id uuid not null references public.instant_orders(id)
);
revoke all on private.cash_deferred_requests from public, anon, authenticated;

create or replace function private.enforce_instant_order_payment_before_ready()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('ready','completed') and new.payment_status is distinct from 'approved'
 and not (new.payment_deferred and new.sales_channel='operation' and new.cash_session_id is not null
   and new.customer_name ~ '\S+\s+\S+') then
  raise exception 'Confirme o pagamento antes de marcar o pedido como pronto ou entregue';
 end if;
 return new;
end; $$;

create or replace function public.staff_create_deferred_cash_sale(
 target_session_id uuid, target_draft_key text, requested_operation_key uuid,
 requested_customer_name text, requested_items jsonb, requested_discount jsonb default '{}', requested_notes text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.cash_sessions%rowtype; o public.instant_orders%rowtype; actor uuid:=auth.uid(); old_id uuid;
 subtotal numeric; discount numeric; conflicts jsonb; line jsonb; choice jsonb; item_id uuid;
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
 if requested_operation_key is null or btrim(requested_customer_name) !~ '\S{2,}\s+\S{2,}' then raise exception 'Informe nome e sobrenome'; end if;
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
 -- Item status is the legacy stock-consumed marker; order payment remains pending.
 update public.instant_orders set status='completed',completed_at=now(),reserved_until=null,payment_expires_at=null,updated_at=now() where id=o.id;
 insert into private.cash_deferred_requests values(requested_operation_key,actor,o.id);
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload) values(actor,'cash.deferred_sale','instant_order',o.id::text,jsonb_build_object('total',o.total));
 return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'remaining',o.total,'completed',true);
end; $$;
revoke all on function public.staff_create_deferred_cash_sale(uuid,text,uuid,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.staff_create_deferred_cash_sale(uuid,text,uuid,text,jsonb,jsonb,text) to authenticated;

create or replace function public.staff_receive_deferred_cash_sale(target_order_id uuid,target_session_id uuid,requested_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.cash_sessions%rowtype; o public.instant_orders%rowtype; amount numeric; actor uuid:=auth.uid();
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
 select * into s from public.cash_sessions where id=target_session_id and status='open' for update;
 if s.id is null or not private.can_access_store(s.store_id) then raise exception 'Abra um caixa autorizado para receber'; end if;
 select * into o from public.instant_orders where id=target_order_id and payment_deferred for update;
 if o.id is null or o.store_id<>s.store_id then raise exception 'Pendência não encontrada nesta loja'; end if;
 if o.payment_status='approved' then return jsonb_build_object('received',true,'already_received',true); end if;
 if requested_method not in ('cash','pix','credit_card','debit_card') or not exists(select 1 from public.payment_methods where code=requested_method and active) then raise exception 'Meio de pagamento inválido'; end if;
 amount:=o.total-o.amount_paid;
 if amount<=0 then raise exception 'Saldo inválido'; end if;
 insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
 values(s.id,s.store_id,s.register_id,'sale','in',requested_method,amount,o.id,'Recebimento de venda com pagamento pendente',actor);
 perform private.snapshot_instant_order_payment(o.id,requested_method);
 update public.instant_orders set payment_status='approved',amount_paid=total,payment_recorded_at=now(),paid_at=now(),payment_allocations=payment_allocations||jsonb_build_array(jsonb_build_object('method',requested_method,'amount',amount,'cash_session_id',s.id)),updated_by=actor,updated_at=now() where id=o.id;
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload) values(actor,'cash.deferred_received','instant_order',o.id::text,jsonb_build_object('amount',amount,'session_id',s.id,'method',requested_method));
 return jsonb_build_object('received',true,'amount',amount);
end; $$;
revoke all on function public.staff_receive_deferred_cash_sale(uuid,uuid,text) from public,anon;
grant execute on function public.staff_receive_deferred_cash_sale(uuid,uuid,text) to authenticated;

create or replace function public.staff_cash_closing_report(target_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.cash_sessions%rowtype;
begin
 select * into s from public.cash_sessions where id=target_session_id;
 if auth.uid() is null or not private.is_staff() or s.id is null or not private.can_access_store(s.store_id) then raise exception 'Acesso não autorizado'; end if;
 return jsonb_build_object('session',to_jsonb(s),
 'slices',coalesce((select jsonb_agg(x) from (select i.flavor_name name,sum(i.quantity) quantity from public.instant_order_items i join public.instant_orders o on o.id=i.order_id where o.cash_session_id=s.id and o.status='completed' group by i.flavor_name order by i.flavor_name) x),'[]'),
 'payments',coalesce((select jsonb_agg(x) from (select payment_method_code method,sum(case when direction='in' then amount else -amount end) amount from public.cash_movements where cash_session_id=s.id and kind in ('sale','refund') group by payment_method_code) x),'[]'),
 'pending',coalesce((select jsonb_agg(x) from (select customer_name,order_number,total-amount_paid remaining from public.instant_orders where cash_session_id=s.id and payment_deferred and payment_status<>'approved' order by created_at) x),'[]'));
end; $$;
revoke all on function public.staff_cash_closing_report(uuid) from public,anon;
grant execute on function public.staff_cash_closing_report(uuid) to authenticated;
