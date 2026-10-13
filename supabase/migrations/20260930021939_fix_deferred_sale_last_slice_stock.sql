-- Consume the sale reservation in the same UPDATE as physical stock, before the item status trigger recalculates remaining reservations.
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
 update public.flavor_availability a set quantity_available=a.quantity_available-r.quantity,quantity_reserved=a.quantity_reserved-r.quantity,updated_at=now()
 from (select flavor_id,stock_service_date,sum(quantity)::int quantity from public.instant_order_items where order_id=o.id and status='reserved' group by 1,2) r
 where a.flavor_id=r.flavor_id and a.service_date=r.stock_service_date;
 update public.instant_order_items set status='paid',updated_at=now() where order_id=o.id and status='reserved';
 update public.instant_orders set status='completed',completed_at=now(),reserved_until=null,payment_expires_at=null,updated_at=now() where id=o.id;
 insert into private.cash_deferred_requests values(requested_operation_key,actor,o.id);
 insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload) values(actor,'cash.deferred_sale','instant_order',o.id::text,jsonb_build_object('total',o.total));
 return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'remaining',o.total,'completed',true);
end; $function$;
