begin;

-- A falta de comprovante libera somente a reserva física; o pedido e a dívida
-- continuam visíveis até confirmação ou cancelamento humano.
create or replace function public.expire_instant_order_reservations()
returns integer language plpgsql security definer set search_path='' as $$
declare target record; released_count integer := 0;
begin
  for target in
    select id,status from public.instant_orders
    where (status='awaiting_payment' and reserved_until is not null and reserved_until<now())
       or (status='reserved' and (created_at at time zone 'America/Fortaleza')::date < (now() at time zone 'America/Fortaleza')::date)
    for update skip locked
  loop
    perform private.release_instant_order_stock(target.id);
    if target.status='awaiting_payment' then
      update public.instant_orders set reserved_until=null,payment_expires_at=null,
        cancellation_reason='Reserva física liberada; pagamento continua pendente',updated_at=now()
      where id=target.id;
      insert into public.audit_events(action,entity_type,entity_id,payload)
      values('instant_order.inventory_reservation_released','instant_order',target.id::text,
        jsonb_build_object('reason','payment_receipt_not_received','order_preserved',true));
    else
      update public.instant_orders set status='expired',payment_status='expired',reserved_until=null,
        cancellation_reason='Reserva de dia anterior encerrada',updated_at=now() where id=target.id;
    end if;
    released_count:=released_count+1;
  end loop;
  return released_count;
end; $$;
revoke all on function public.expire_instant_order_reservations() from public,anon,authenticated;
grant execute on function public.expire_instant_order_reservations() to service_role;

create index if not exists whatsapp_support_threads_activity_idx
  on private.whatsapp_support_threads(status,last_message_at desc,id desc);
create index if not exists whatsapp_support_messages_page_idx
  on private.whatsapp_support_messages(thread_id,created_at desc,id desc);

create or replace function public.server_list_whatsapp_support_threads_page(
  requested_status text default 'active', requested_cursor_at timestamptz default null,
  requested_cursor_id uuid default null, requested_limit integer default 50
) returns jsonb language sql stable security definer set search_path='' as $$
with page as (
  select t.* from private.whatsapp_support_threads t
  where (case when requested_status='history' then t.status='closed' else t.status in ('waiting','open') end)
    and (requested_cursor_at is null or (t.last_message_at,t.id)<(requested_cursor_at,requested_cursor_id))
  order by t.last_message_at desc,t.id desc limit greatest(1,least(coalesce(requested_limit,50),100))+1
), visible as (select * from page order by last_message_at desc,id desc limit greatest(1,least(coalesce(requested_limit,50),100)))
select jsonb_build_object(
 'threads',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.id,'phone_last4',t.phone_last4,'department',t.department,'status',t.status,
   'automation_mode',t.automation_mode,'last_message_at',t.last_message_at,
   'assigned_staff_user_id',t.assigned_staff_user_id,
   'has_customer_messages',exists(select 1 from private.whatsapp_support_messages m where m.thread_id=t.id and m.direction='inbound'),
   'last_message',(select m.body from private.whatsapp_support_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1)
 ) order by t.last_message_at desc,t.id desc) from visible t),'[]'::jsonb),
 'has_more',(select count(*)>greatest(1,least(coalesce(requested_limit,50),100)) from page),
 'next_cursor',(select jsonb_build_object('at',last_message_at,'id',id) from visible order by last_message_at,id limit 1)
); $$;

create or replace function public.server_get_whatsapp_support_thread_page(
 requested_thread_id uuid, requested_before_at timestamptz default null,
 requested_before_id bigint default null, requested_limit integer default 50
) returns jsonb language sql stable security definer set search_path='' as $$
with target as (select * from private.whatsapp_support_threads where id=requested_thread_id),
page as (
 select m.* from private.whatsapp_support_messages m where m.thread_id=requested_thread_id
 and (requested_before_at is null or (m.created_at,m.id)<(requested_before_at,requested_before_id))
 order by m.created_at desc,m.id desc limit greatest(1,least(coalesce(requested_limit,50),100))+1
), visible as (select * from page order by created_at desc,id desc limit greatest(1,least(coalesce(requested_limit,50),100)))
select jsonb_build_object('id',t.id,'phone_last4',t.phone_last4,'department',t.department,'status',t.status,
 'automation_mode',t.automation_mode,'source_message_sid',t.source_message_sid,'assigned_staff_user_id',t.assigned_staff_user_id,
 'has_more_messages',(select count(*)>greatest(1,least(coalesce(requested_limit,50),100)) from page),
 'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'direction',m.direction,'author_kind',m.author_kind,
 'body',m.body,'staff_user_id',m.staff_user_id,'created_at',m.created_at,'media_kind',m.media_kind,'media_bucket',m.media_bucket,
 'media_storage_path',m.media_storage_path,'media_content_type',m.media_content_type,'media_filename',m.media_filename,
 'media_size_bytes',m.media_size_bytes,'media_duration_seconds',m.media_duration_seconds) order by m.created_at,m.id) from visible m),'[]'::jsonb),
 'scheduled_messages',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'body',s.body,'scheduled_at',s.scheduled_at,
 'status',s.status,'attempts',s.attempts,'last_error',s.last_error,'created_at',s.created_at) order by s.scheduled_at,s.created_at)
 from private.whatsapp_scheduled_support_messages s where s.thread_id=t.id and s.status in('pending','processing','failed')),'[]'::jsonb)
 ) from target t; $$;

create or replace function public.server_archive_whatsapp_support_threads(requested_thread_ids uuid[],requested_staff_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_id uuid; affected integer:=0;
begin
 if coalesce(array_length(requested_thread_ids,1),0) not between 1 and 100 then raise exception 'Seleção inválida'; end if;
 if not exists(select 1 from public.staff_members where user_id=requested_staff_user_id and active and role in ('owner','manager')) then
   raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 foreach target_id in array requested_thread_ids loop
   if exists(select 1 from private.whatsapp_support_threads where id=target_id and status<>'closed') then
     perform public.server_end_whatsapp_support_chat(target_id,requested_staff_user_id); affected:=affected+1;
   end if;
 end loop;
 return jsonb_build_object('archived',affected);
end; $$;

alter table private.whatsapp_order_conversations drop constraint if exists whatsapp_order_conversations_step_check;
alter table private.whatsapp_order_conversations add constraint whatsapp_order_conversations_step_check check(step in(
 'existing_order_choice','choose_items','name','sauce','payment','pickup_method','pickup_time','confirm','handoff','completed'));

create or replace function public.server_save_whatsapp_order_conversation(
 requested_phone_hmac text,requested_phone_last4 text,requested_step text,requested_state jsonb,requested_expires_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$ begin
 if coalesce(requested_phone_hmac,'')!~'^[a-f0-9]{64}$' or coalesce(requested_phone_last4,'')!~'^[0-9]{4}$'
 or requested_step not in('existing_order_choice','choose_items','name','sauce','payment','pickup_method','pickup_time','confirm','handoff','completed')
 or jsonb_typeof(requested_state)<>'object' or octet_length(requested_state::text)>20000
 or requested_expires_at<=now()+interval '1 minute' or requested_expires_at>now()+interval '25 hours'
 then raise exception 'Estado de conversa invalido' using errcode='22023'; end if;
 insert into private.whatsapp_order_conversations(phone_hmac,phone_last4,step,state,expires_at)
 values(requested_phone_hmac,requested_phone_last4,requested_step,requested_state,requested_expires_at)
 on conflict(phone_hmac) do update set phone_last4=excluded.phone_last4,step=excluded.step,state=excluded.state,
 expires_at=excluded.expires_at,updated_at=now();
end; $$;

create or replace function public.server_find_whatsapp_orders_today(requested_customer_phone text)
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('order_number',o.order_number,'status',o.status,'created_at',o.created_at)
 order by o.created_at desc),'[]'::jsonb) from (
 select * from public.instant_orders
 where regexp_replace(customer_phone,'\D','','g')=regexp_replace(requested_customer_phone,'\D','','g')
 and (created_at at time zone 'America/Fortaleza')::date=(now() at time zone 'America/Fortaleza')::date
 and status not in('cancelled','expired') order by created_at desc limit 5
) o; $$;

revoke all on function public.server_list_whatsapp_support_threads_page(text,timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.server_get_whatsapp_support_thread_page(uuid,timestamptz,bigint,integer) from public,anon,authenticated;
revoke all on function public.server_archive_whatsapp_support_threads(uuid[],uuid) from public,anon,authenticated;
revoke all on function public.server_find_whatsapp_orders_today(text) from public,anon,authenticated;
revoke all on function public.server_save_whatsapp_order_conversation(text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.server_list_whatsapp_support_threads_page(text,timestamptz,uuid,integer) to service_role;
grant execute on function public.server_get_whatsapp_support_thread_page(uuid,timestamptz,bigint,integer) to service_role;
grant execute on function public.server_archive_whatsapp_support_threads(uuid[],uuid) to service_role;
grant execute on function public.server_find_whatsapp_orders_today(text) to service_role;
grant execute on function public.server_save_whatsapp_order_conversation(text,text,text,jsonb,timestamptz) to service_role;

commit;
