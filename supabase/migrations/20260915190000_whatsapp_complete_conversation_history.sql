begin;
alter table private.whatsapp_support_messages add column if not exists media_bucket text not null default 'whatsapp-support-media' check (media_bucket in ('whatsapp-support-media','order-payment-receipts'));
create or replace function public.server_store_whatsapp_inbound_media(requested_thread_id uuid,requested_sid text,requested_body text,requested_kind text,requested_path text,requested_type text,requested_filename text,requested_size integer,requested_bucket text)
returns void language plpgsql security definer set search_path='' as $$ begin
 insert into private.whatsapp_support_messages(thread_id,message_sid,direction,body,media_kind,media_storage_path,media_content_type,media_filename,media_size_bytes,media_bucket)
 values(requested_thread_id,requested_sid,'inbound',left(requested_body,4000),requested_kind,requested_path,requested_type,requested_filename,requested_size,requested_bucket)
 on conflict(message_sid) do nothing;
end; $$;
revoke all on function public.server_store_whatsapp_inbound_media(uuid,text,text,text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.server_store_whatsapp_inbound_media(uuid,text,text,text,text,text,text,integer,text) to service_role;
alter table private.whatsapp_support_threads add column if not exists automation_mode text not null default 'human' check (automation_mode in ('bot','human'));
alter table private.whatsapp_support_messages add column if not exists author_kind text not null default 'customer' check (author_kind in ('customer','bot','staff','system'));
update private.whatsapp_support_messages set author_kind=case when direction='system' then 'system' when direction='outbound' then 'staff' else 'customer' end;
alter table private.whatsapp_support_threads enable row level security;
alter table private.whatsapp_support_messages enable row level security;

-- Record each inbound once, including numeric choices, before the bot handles it.
create or replace function public.server_observe_whatsapp_message(requested_phone_hmac text,requested_phone_last4 text,requested_message_sid text,requested_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target private.whatsapp_support_threads%rowtype;
begin
  insert into private.whatsapp_support_threads(phone_hmac,phone_last4,department,status,source_message_sid,automation_mode)
  values(requested_phone_hmac,requested_phone_last4,'festival','waiting',requested_message_sid,'bot')
  on conflict(phone_hmac) do update set source_message_sid=excluded.source_message_sid,last_message_at=clock_timestamp(),updated_at=clock_timestamp(),
    status=case when whatsapp_support_threads.status='closed' then 'waiting' else whatsapp_support_threads.status end,
    automation_mode=case when whatsapp_support_threads.status='closed' then 'bot' else whatsapp_support_threads.automation_mode end,closed_at=null
  returning * into target;
  insert into private.whatsapp_support_messages(thread_id,message_sid,direction,body,author_kind)
  values(target.id,requested_message_sid,'inbound',left(coalesce(nullif(requested_body,''),'[Anexo recebido]'),4000),'customer') on conflict(message_sid) do nothing;
  return jsonb_build_object('id',target.id,'automation_mode',target.automation_mode);
end; $$;

-- The response and saved bot state are committed together. A human takeover suppresses both.
create or replace function public.server_finish_observed_whatsapp_message(
 requested_message_sid text,requested_phone_hmac text,requested_phone_last4 text,requested_response_xml text,
 requested_body text,requested_step text default null,requested_state jsonb default null,requested_expires_at timestamptz default null,
 requested_clear boolean default false,requested_handoff boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare target private.whatsapp_support_threads%rowtype; response text:=requested_response_xml;
begin
 select * into target from private.whatsapp_support_threads where phone_hmac=requested_phone_hmac for update;
 if not found then raise exception 'Historico indisponivel'; end if;
 if target.automation_mode='human' and not requested_handoff then
   response:='<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
   perform public.server_complete_whatsapp_order_message(requested_message_sid,requested_phone_hmac,response);
 else
   perform public.server_finish_whatsapp_order_message(requested_message_sid,requested_phone_hmac,requested_phone_last4,response,
     requested_step,requested_state,requested_expires_at,requested_clear);
   if coalesce(requested_body,'')<>'' then
     insert into private.whatsapp_support_messages(thread_id,message_sid,direction,body,author_kind)
     values(target.id,left(requested_message_sid,76)||'-bot','outbound',left(requested_body,4000),'bot') on conflict(message_sid) do nothing;
     update private.whatsapp_support_threads set last_message_at=clock_timestamp() where id=target.id;
   end if;
 end if;
 return response;
end; $$;

create or replace function public.server_set_whatsapp_conversation_mode(requested_thread_id uuid,requested_staff_user_id uuid,requested_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare target private.whatsapp_support_threads%rowtype;
begin
 if requested_mode not in ('human','bot') or not exists(select 1 from public.staff_members where user_id=requested_staff_user_id and active) then raise exception 'Operador invalido' using errcode='42501'; end if;
 select * into target from private.whatsapp_support_threads where id=requested_thread_id and status<>'closed' for update;
 if not found then raise exception 'Conversa indisponivel'; end if;
 -- Wait for the in-flight webhook rather than race its order creation or response.
 if exists(select 1 from private.whatsapp_order_messages where phone_hmac=target.phone_hmac and status='processing' and started_at>now()-interval '60 seconds') then
   raise exception 'O robo esta concluindo uma resposta. Tente assumir novamente em alguns segundos.' using errcode='55P03';
 end if;
 if target.automation_mode='human' and target.assigned_staff_user_id is not null and target.assigned_staff_user_id<>requested_staff_user_id then
   raise exception 'Outra pessoa da equipe assumiu esta conversa.' using errcode='55P03';
 end if;
 update private.whatsapp_support_threads set automation_mode=requested_mode,status=case when requested_mode='human' then 'open' else 'waiting' end,
 assigned_staff_user_id=case when requested_mode='human' then requested_staff_user_id else null end,updated_at=clock_timestamp() where id=target.id;
 -- An explicitly requested human handoff has no resumable cart. Other bot steps are preserved.
 if requested_mode='bot' then delete from private.whatsapp_order_conversations where phone_hmac=target.phone_hmac and step='handoff'; end if;
 insert into private.whatsapp_support_messages(thread_id,direction,body,staff_user_id,author_kind)
 values(target.id,'system',case when requested_mode='human' then 'Equipe assumiu a conversa. Robo pausado.' else 'Equipe devolveu a conversa ao robo.' end,requested_staff_user_id,'system');
end; $$;

create or replace function public.server_record_whatsapp_stage_message(requested_phone_hmac text,requested_sid text,requested_body text,requested_phone_last4 text,requested_source_sid text)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.whatsapp_support_threads(phone_hmac,phone_last4,department,status,source_message_sid,automation_mode)
 values(requested_phone_hmac,requested_phone_last4,'festival','waiting',requested_source_sid,'bot')
 on conflict(phone_hmac) do update set
   source_message_sid=excluded.source_message_sid,
   status=case when whatsapp_support_threads.status='closed' then 'waiting' else whatsapp_support_threads.status end,
   automation_mode=case when whatsapp_support_threads.status='closed' then 'bot' else whatsapp_support_threads.automation_mode end,closed_at=null;
 insert into private.whatsapp_support_messages(thread_id,message_sid,direction,body,author_kind)
 select id,requested_sid,'outbound',left(requested_body,4000),'bot' from private.whatsapp_support_threads where phone_hmac=requested_phone_hmac
 on conflict(message_sid) do update set body=excluded.body;
 update private.whatsapp_support_threads set last_message_at=clock_timestamp() where phone_hmac=requested_phone_hmac;
end; $$;

revoke all on function public.server_observe_whatsapp_message(text,text,text,text) from public,anon,authenticated;
revoke all on function public.server_finish_observed_whatsapp_message(text,text,text,text,text,text,jsonb,timestamptz,boolean,boolean) from public,anon,authenticated;
revoke all on function public.server_set_whatsapp_conversation_mode(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.server_record_whatsapp_stage_message(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.server_observe_whatsapp_message(text,text,text,text) to service_role;
grant execute on function public.server_finish_observed_whatsapp_message(text,text,text,text,text,text,jsonb,timestamptz,boolean,boolean) to service_role;
grant execute on function public.server_set_whatsapp_conversation_mode(uuid,uuid,text) to service_role;
grant execute on function public.server_record_whatsapp_stage_message(text,text,text,text,text) to service_role;
create or replace function public.server_list_whatsapp_support_threads()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', thread.id,
    'phone_last4', thread.phone_last4,
    'department', thread.department,
    'status', thread.status,
    'automation_mode', thread.automation_mode,
    'last_message_at', thread.last_message_at,
    'assigned_staff_user_id', thread.assigned_staff_user_id,
    'last_message', (
      select message.body
      from private.whatsapp_support_messages message
      where message.thread_id = thread.id
      order by message.created_at desc, message.id desc
      limit 1
    )
  ) order by thread.last_message_at desc), '[]'::jsonb)
  from private.whatsapp_support_threads thread
  where thread.status in ('waiting', 'open');
$$;
create or replace function public.server_get_whatsapp_support_thread(
  requested_thread_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', thread.id,
    'phone_last4', thread.phone_last4,
    'department', thread.department,
    'status', thread.status,
    'automation_mode', thread.automation_mode,
    'source_message_sid', thread.source_message_sid,
    'assigned_staff_user_id', thread.assigned_staff_user_id,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', message.id,
        'direction', message.direction,
        'author_kind', message.author_kind,
        'body', message.body,
        'staff_user_id', message.staff_user_id,
        'created_at', message.created_at,
        'media_kind', message.media_kind,
        'media_bucket', message.media_bucket,
        'media_storage_path', message.media_storage_path,
        'media_content_type', message.media_content_type,
        'media_filename', message.media_filename,
        'media_size_bytes', message.media_size_bytes,
        'media_duration_seconds', message.media_duration_seconds
      ) order by message.created_at, message.id)
      from private.whatsapp_support_messages message
      where message.thread_id = thread.id
        
    ), '[]'::jsonb)
  )
  from private.whatsapp_support_threads thread
  where thread.id = requested_thread_id;
$$;
create or replace function public.server_open_whatsapp_support_thread(
  requested_phone_hmac text,
  requested_phone_last4 text,
  requested_department text,
  requested_message_sid text,
  requested_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread_id uuid;
  safe_body text := left(btrim(coalesce(requested_body, '')), 4000);
begin
  if coalesce(requested_phone_hmac, '') !~ '^[a-f0-9]{64}$'
     or coalesce(requested_phone_last4, '') !~ '^[0-9]{4}$'
     or requested_department not in ('festival', 'quote')
     or char_length(coalesce(requested_message_sid, '')) not between 8 and 80 then
    raise exception 'Atendimento humano invalido' using errcode = '22023';
  end if;


  delete from private.whatsapp_support_threads
    where status = 'closed' and closed_at < now() - interval '30 days';

  insert into private.whatsapp_support_threads(
    phone_hmac, phone_last4, department, status, source_message_sid,
    assigned_staff_user_id, updated_at, last_message_at, closed_at
  ) values (
    requested_phone_hmac, requested_phone_last4, requested_department, 'waiting',
    requested_message_sid, null, now(), now(), null
  )
  on conflict (phone_hmac) do update set
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
  values (
    thread_id,
    left(requested_message_sid,72)||'-handoff',
    'system',
    case requested_department
      when 'festival' then 'Cliente solicitou atendimento sobre o Festival de Fatias.'
      else 'Cliente solicitou atendimento para realizar um orcamento.'
    end
  ) on conflict (message_sid) do nothing;

  return thread_id;
end;
$$;
create or replace function private.stamp_whatsapp_message_author() returns trigger language plpgsql set search_path='' as $$ begin
 if new.staff_user_id is not null then new.author_kind:=case when new.direction='system' then 'system' else 'staff' end;
 elsif new.direction='system' then new.author_kind:='system'; end if; return new; end; $$;
revoke all on function private.stamp_whatsapp_message_author() from public,anon,authenticated;
create trigger whatsapp_message_author before insert on private.whatsapp_support_messages for each row execute function private.stamp_whatsapp_message_author();
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-support-media',
  'whatsapp-support-media',
  false,
  16777216,
  array[
    'audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg','audio/opus','audio/webm',
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/3gpp','video/quicktime','video/webm',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 16777216,
  allowed_mime_types = excluded.allowed_mime_types;


commit;
