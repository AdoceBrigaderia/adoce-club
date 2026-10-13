-- Todas as mensagens notificam a tela, inclusive respostas automáticas.
drop trigger if exists whatsapp_support_messages_realtime on private.whatsapp_support_messages;
create trigger whatsapp_support_messages_realtime after insert on private.whatsapp_support_messages
for each row execute function private.enqueue_whatsapp_support_realtime();

create or replace function public.server_end_whatsapp_support_chat(requested_thread_id uuid,requested_staff_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.whatsapp_support_threads%rowtype;
begin
 if not exists(select 1 from public.staff_members where user_id=requested_staff_user_id and active and role in ('owner','manager')) then raise exception 'Acesso não autorizado'; end if;
 select * into t from private.whatsapp_support_threads where id=requested_thread_id for update;
 if not found then raise exception 'Conversa não encontrada'; end if;
 if t.status='closed' then return jsonb_build_object('closed',true); end if;
 perform public.server_close_whatsapp_support_thread(t.id,requested_staff_user_id);
 perform public.server_clear_whatsapp_order_conversation(t.phone_hmac);
 insert into private.whatsapp_support_messages(thread_id,direction,body,author_kind,staff_user_id)
 values(t.id,'system','Chat encerrado pela equipe. Histórico preservado.','system',requested_staff_user_id);
 return jsonb_build_object('closed',true);
end; $$;
revoke all on function public.server_end_whatsapp_support_chat(uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_end_whatsapp_support_chat(uuid,uuid) to service_role;

create or replace function public.server_list_whatsapp_support_threads()
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'phone_last4',t.phone_last4,'department',t.department,'status',t.status,'automation_mode',t.automation_mode,'last_message_at',t.last_message_at,'assigned_staff_user_id',t.assigned_staff_user_id,
 'has_customer_messages',exists(select 1 from private.whatsapp_support_messages m where m.thread_id=t.id and m.direction='inbound' and (t.closed_at is null or m.created_at>t.closed_at)),
 'last_message',(select body from private.whatsapp_support_messages where thread_id=t.id order by created_at desc,id desc limit 1)) order by t.last_message_at desc),'[]')
from private.whatsapp_support_threads t where t.status in ('waiting','open'); $$;
revoke all on function public.server_list_whatsapp_support_threads() from public,anon,authenticated;
grant execute on function public.server_list_whatsapp_support_threads() to service_role;

create or replace function public.staff_record_cash_expense(requested_operation_key uuid,target_session_id uuid,requested_payment_method text,requested_amount numeric,requested_description text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare store uuid; result jsonb; movement public.cash_movements%rowtype;
begin
 select store_id into store from public.cash_sessions where id=target_session_id and status='open' for update;
 if auth.uid() is null or not private.is_manager() or store is null or not private.can_access_store(store) then raise exception 'Abra um caixa autorizado para lançar despesas'; end if;
 if length(btrim(coalesce(requested_description,'')))<3 then raise exception 'Descreva a despesa'; end if;
 if requested_payment_method not in ('cash','pix','credit_card','debit_card') or not exists(select 1 from public.payment_methods where code=requested_payment_method and active) then raise exception 'Forma de pagamento inválida'; end if;
 result:=public.staff_record_cash_movement_v2(requested_operation_key,target_session_id,'expense',requested_payment_method,requested_amount,requested_description,null);
 update public.cash_movements set payment_method_code=requested_payment_method where id=(result->>'id')::uuid returning * into movement;
 return to_jsonb(movement);
end; $$;
revoke all on function public.staff_record_cash_expense(uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.staff_record_cash_expense(uuid,uuid,text,numeric,text) to authenticated;

create or replace function public.staff_cash_closing_report(target_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.cash_sessions%rowtype;
begin
 select * into s from public.cash_sessions where id=target_session_id;
 if auth.uid() is null or not private.is_staff() or s.id is null or not private.can_access_store(s.store_id) then raise exception 'Acesso não autorizado'; end if;
 return jsonb_build_object('session',to_jsonb(s)||jsonb_build_object('expected_cash',coalesce(s.expected_cash,private.cash_expected_amount(s.id))),
 'expenses',coalesce((select jsonb_agg(jsonb_build_object('description',notes,'method',payment_method_code,'amount',amount) order by created_at) from public.cash_movements where cash_session_id=s.id and kind='expense'),'[]'),
 'pix_change',coalesce((select jsonb_agg(x) from (select coalesce(change_pix_source,'Conta pessoal') source,sum(change_pix_amount) amount from public.instant_orders where cash_session_id=s.id and status='completed' and change_pix_amount>0 group by change_pix_source) x),'[]'),
 'slices',coalesce((select jsonb_agg(x) from (select i.flavor_name name,sum(i.quantity) quantity from public.instant_order_items i join public.instant_orders o on o.id=i.order_id where o.cash_session_id=s.id and o.status='completed' group by i.flavor_name order by i.flavor_name) x),'[]'),
 'payments',coalesce((select jsonb_agg(x) from (select payment_method_code method,sum(case when direction='in' then amount else -amount end) amount from public.cash_movements where cash_session_id=s.id and kind in ('sale','refund') group by payment_method_code) x),'[]'),
 'pending',coalesce((select jsonb_agg(x) from (select customer_name,order_number,total-amount_paid remaining from public.instant_orders where cash_session_id=s.id and payment_deferred and payment_status<>'approved' order by created_at) x),'[]'));
end; $$;
revoke all on function public.staff_cash_closing_report(uuid) from public,anon;
grant execute on function public.staff_cash_closing_report(uuid) to authenticated;
