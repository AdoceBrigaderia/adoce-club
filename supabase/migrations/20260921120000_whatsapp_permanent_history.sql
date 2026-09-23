-- Preserve recorded conversations and expose closed chats to the authorized server only.
create or replace function public.server_open_whatsapp_support_thread(
  requested_phone_hmac text, requested_phone_last4 text, requested_department text,
  requested_message_sid text, requested_body text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare thread_id uuid;
begin
  if coalesce(requested_phone_hmac, '') !~ '^[a-f0-9]{64}$'
     or coalesce(requested_phone_last4, '') !~ '^[0-9]{4}$'
     or requested_department not in ('festival', 'quote')
     or char_length(coalesce(requested_message_sid, '')) not between 8 and 80 then
    raise exception 'Atendimento humano invalido' using errcode = '22023';
  end if;

  insert into private.whatsapp_support_threads(
    phone_hmac, phone_last4, department, status, source_message_sid,
    assigned_staff_user_id, updated_at, last_message_at, closed_at
  ) values (
    requested_phone_hmac, requested_phone_last4, requested_department, 'waiting',
    requested_message_sid, null, now(), now(), null
  ) on conflict (phone_hmac) do update set
    phone_last4 = excluded.phone_last4,
    department = excluded.department,
    status = 'waiting',
    automation_mode = 'human',
    source_message_sid = excluded.source_message_sid,
    assigned_staff_user_id = null,
    updated_at = now(),
    last_message_at = now(),
    closed_at = null
  returning id into thread_id;

  insert into private.whatsapp_support_messages(thread_id, message_sid, direction, body)
  values (thread_id, left(requested_message_sid,72)||'-handoff', 'system',
    case requested_department
      when 'festival' then 'Cliente solicitou atendimento sobre o Festival de Fatias.'
      else 'Cliente solicitou atendimento para realizar um orcamento.' end)
  on conflict (message_sid) do nothing;
  return thread_id;
end; $$;
revoke all on function public.server_open_whatsapp_support_thread(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.server_open_whatsapp_support_thread(text,text,text,text,text) to service_role;

create or replace function public.server_list_whatsapp_support_history()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'phone_last4',t.phone_last4,'department',t.department,
    'status',t.status,'automation_mode',t.automation_mode,
    'last_message_at',t.last_message_at,'assigned_staff_user_id',t.assigned_staff_user_id,
    'has_customer_messages',exists(select 1 from private.whatsapp_support_messages m where m.thread_id=t.id and m.direction='inbound'),
    'last_message',(select body from private.whatsapp_support_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1)
  ) order by t.last_message_at desc),'[]'::jsonb)
  from private.whatsapp_support_threads t where t.status='closed';
$$;
revoke all on function public.server_list_whatsapp_support_history() from public,anon,authenticated;
grant execute on function public.server_list_whatsapp_support_history() to service_role;
