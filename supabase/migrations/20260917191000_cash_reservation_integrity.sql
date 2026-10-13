-- Rascunhos compartilham o mesmo contador que os pedidos. Conversão atômica.
create or replace function private.recalcular_reserva_de_fatias(alvo_flavor uuid, alvo_data date)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.flavor_availability a set quantity_reserved =
 coalesce((select sum(i.quantity)::int from public.instant_order_items i join public.instant_orders o on o.id=i.order_id where i.flavor_id=alvo_flavor and coalesce(i.stock_service_date,(o.created_at at time zone 'America/Fortaleza')::date)=alvo_data and o.status not in ('cancelled','expired') and i.status='reserved'),0)
 + coalesce((select sum(d.quantity)::int from public.cash_draft_reservations d where d.flavor_id=alvo_flavor and d.service_date=alvo_data),0), updated_at=now()
 where a.flavor_id=alvo_flavor and a.service_date=alvo_data;
end; $$;

create or replace function public.staff_release_cash_draft_reservation(target_session_id uuid,target_draft_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; released int:=0; actor uuid:=(select auth.uid()); store uuid;
begin
 select store_id into store from public.cash_sessions where id=target_session_id for update;
 if actor is null or not private.is_staff() or not coalesce(private.can_access_store(store),false) then raise exception 'Acesso não autorizado'; end if;
 if exists(select 1 from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and created_by<>actor) then raise exception 'Este pedido pertence a outro atendente'; end if;
 for r in select * from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key order by flavor_id for update loop
  perform 1 from public.flavor_availability where flavor_id=r.flavor_id and service_date=r.service_date for update;
  delete from public.cash_draft_reservations where id=r.id;
  perform private.recalcular_reserva_de_fatias(r.flavor_id,r.service_date);
  released:=released+r.quantity;
 end loop;
 return jsonb_build_object('released',released);
end; $$;

create or replace function public.staff_set_cash_draft_reservation(target_session_id uuid,target_draft_key text,requested_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); today date:=(now() at time zone 'America/Fortaleza')::date; store uuid; r record; a public.flavor_availability%rowtype; previous int;
begin
 select store_id into store from public.cash_sessions where id=target_session_id and status='open' for update;
 if actor is null or not private.is_staff() or store is null or not coalesce(private.can_access_store(store),false) then raise exception 'Abra um caixa autorizado'; end if;
 if target_draft_key is null or char_length(target_draft_key)<8 or jsonb_typeof(requested_items)<>'array' then raise exception 'Pedido inválido'; end if;
 if exists(select 1 from jsonb_array_elements(requested_items) x where (x->>'quantity')::numeric<>trunc((x->>'quantity')::numeric) or (x->>'quantity')::int not between 1 and 60 or x->>'flavor_id' is null) then raise exception 'Quantidade inválida'; end if;
 if exists(select 1 from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and created_by<>actor) then raise exception 'Pedido de outro atendente'; end if;
 perform 1 from public.flavor_availability where service_date=today and flavor_id in(select (x->>'flavor_id')::uuid from jsonb_array_elements(requested_items) x union select flavor_id from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key) order by flavor_id for update;
 for r in select (x->>'flavor_id')::uuid fid,sum((x->>'quantity')::int)::int qty from jsonb_array_elements(requested_items) x group by 1 loop
  select * into a from public.flavor_availability where flavor_id=r.fid and service_date=today;
  select coalesce(sum(quantity),0) into previous from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and flavor_id=r.fid and service_date=today;
  if a.id is null or a.status in ('sold_out','unavailable') or coalesce(a.quantity_available-a.quantity_reserved,0)+previous<r.qty then return jsonb_build_object('accepted',false,'message','Estoque insuficiente'); end if;
 end loop;
 perform public.staff_release_cash_draft_reservation(target_session_id,target_draft_key);
 for r in select (x->>'flavor_id')::uuid fid,sum((x->>'quantity')::int)::int qty from jsonb_array_elements(requested_items) x group by 1 loop
  insert into public.cash_draft_reservations(session_id,draft_key,flavor_id,service_date,quantity,created_by,expires_at) values(target_session_id,target_draft_key,r.fid,today,r.qty,actor,now()+interval '30 minutes');
  perform private.recalcular_reserva_de_fatias(r.fid,today);
 end loop;
 return jsonb_build_object('accepted',true);
end; $$;

create or replace function public.staff_create_manual_sale_in_cash_v4(requested_operation_key uuid,target_session_id uuid,target_draft_key text,requested_customer_name text,requested_customer_phone text,requested_items jsonb,requested_payment_method text,requested_discount jsonb,requested_payments jsonb,requested_notes text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; line jsonb; item_id uuid; choice jsonb;
begin
 -- Release and consume happen under the same transaction and row locks.
 perform public.staff_release_cash_draft_reservation(target_session_id,target_draft_key);
 result:=public.staff_create_manual_sale_in_cash_v3(requested_operation_key,target_session_id,requested_customer_name,requested_customer_phone,requested_items,requested_payment_method,requested_discount,requested_payments,requested_notes);
 for line in select * from jsonb_array_elements(requested_items) loop
  select id into item_id from public.instant_order_items where order_id=(result->>'order_id')::uuid and flavor_id=(line->>'flavor_id')::uuid limit 1;
  for choice in select * from jsonb_array_elements(coalesce(line->'sauces','[]')) loop
   if nullif(choice->>'sauce_id','') is not null and not exists(select 1 from public.instant_order_item_sauces where order_item_id=item_id and unit_number=(choice->>'unit_number')::int) then
    insert into public.instant_order_item_sauces(order_item_id,unit_number,sauce_id,sauce_name) select item_id,(choice->>'unit_number')::int,id,name from public.order_sauces where id=(choice->>'sauce_id')::uuid and active;
   end if;
  end loop;
 end loop;
 return result;
end; $$;
revoke all on function public.staff_create_manual_sale_in_cash_v4(uuid,uuid,text,text,text,jsonb,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.staff_create_manual_sale_in_cash_v4(uuid,uuid,text,text,text,jsonb,text,jsonb,jsonb,text) to authenticated;

create or replace function public.staff_submit_cash_order_v1(target_session_id uuid,target_draft_key text,requested_customer_name text,requested_customer_phone text,requested_items jsonb,requested_payment_method text,requested_notes text,requested_reward jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.staff_release_cash_draft_reservation(target_session_id,target_draft_key);
 result:=public.staff_submit_instant_order_v5(requested_customer_name,requested_customer_phone,requested_items,requested_payment_method,requested_notes,requested_reward);
 if not coalesce((result->>'accepted')::boolean,false) then raise exception '%',coalesce(result->>'message','Não foi possível reservar'); end if;
 return result;
end; $$;
revoke all on function public.staff_submit_cash_order_v1(uuid,text,text,text,jsonb,text,text,jsonb) from public,anon;
grant execute on function public.staff_submit_cash_order_v1(uuid,text,text,text,jsonb,text,text,jsonb) to authenticated;
