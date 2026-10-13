begin;

create table if not exists private.whatsapp_support_threads (
  id uuid primary key default gen_random_uuid(),
  phone_hmac text not null unique check (phone_hmac ~ '^[a-f0-9]{64}$'),
  phone_last4 text not null check (phone_last4 ~ '^[0-9]{4}$'),
  department text not null check (department in ('festival', 'quote')),
  status text not null default 'waiting' check (status in ('waiting', 'open', 'closed')),
  source_message_sid text not null check (char_length(source_message_sid) between 8 and 80),
  assigned_staff_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists private.whatsapp_support_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references private.whatsapp_support_threads(id) on delete cascade,
  message_sid text unique check (message_sid is null or char_length(message_sid) between 8 and 80),
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  staff_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_support_threads_status_idx
  on private.whatsapp_support_threads(status, last_message_at desc);
create index if not exists whatsapp_support_messages_thread_idx
  on private.whatsapp_support_messages(thread_id, created_at, id);

revoke all on table private.whatsapp_support_threads from public, anon, authenticated;
revoke all on table private.whatsapp_support_messages from public, anon, authenticated;
grant select, insert, update, delete on table private.whatsapp_support_threads to service_role;
grant select, insert, update, delete on table private.whatsapp_support_messages to service_role;
grant usage, select on sequence private.whatsapp_support_messages_id_seq to service_role;

comment on table private.whatsapp_support_threads is
  'Fila privada de atendimento humano do WhatsApp; o telefone completo permanece somente na Twilio.';
comment on table private.whatsapp_support_messages is
  'Historico privado do atendimento humano, retido por no maximo 30 dias.';

create or replace function public.server_prepare_whatsapp_order_message(
  requested_message_sid text,
  requested_phone_hmac text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb;
  rate_limit jsonb;
  conversation jsonb;
begin
  claim := public.server_begin_whatsapp_order_message(
    requested_message_sid,
    requested_phone_hmac
  );
  if not coalesce((claim->>'process')::boolean, false) then
    return claim || jsonb_build_object('allowed', true, 'conversation', null);
  end if;

  rate_limit := public.consume_public_endpoint_rate_limit_bff(
    'whatsapp-order:inbound', requested_phone_hmac, 3600, 80
  );
  if not coalesce((rate_limit->>'allowed')::boolean, false) then
    return claim || jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', coalesce((rate_limit->>'retry_after_seconds')::integer, 60),
      'conversation', null
    );
  end if;

  conversation := public.server_get_whatsapp_order_conversation(requested_phone_hmac);
  return claim || jsonb_build_object('allowed', true, 'conversation', conversation);
end;
$$;

create or replace function public.server_finish_whatsapp_order_message(
  requested_message_sid text,
  requested_phone_hmac text,
  requested_phone_last4 text,
  requested_response_xml text,
  requested_step text default null,
  requested_state jsonb default null,
  requested_expires_at timestamptz default null,
  requested_clear boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_clear then
    perform public.server_clear_whatsapp_order_conversation(requested_phone_hmac);
  end if;
  if requested_step is not null then
    perform public.server_save_whatsapp_order_conversation(
      requested_phone_hmac,
      requested_phone_last4,
      requested_step,
      coalesce(requested_state, '{}'::jsonb),
      requested_expires_at
    );
  end if;
  perform public.server_complete_whatsapp_order_message(
    requested_message_sid,
    requested_phone_hmac,
    requested_response_xml
  );
end;
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

  delete from private.whatsapp_support_messages where created_at < now() - interval '30 days';
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
    source_message_sid = excluded.source_message_sid,
    assigned_staff_user_id = null,
    updated_at = now(),
    last_message_at = now(),
    closed_at = null
  returning id into thread_id;

  insert into private.whatsapp_support_messages(thread_id, message_sid, direction, body)
  values (
    thread_id,
    requested_message_sid,
    'system',
    case requested_department
      when 'festival' then 'Cliente solicitou atendimento sobre o Festival de Fatias.'
      else 'Cliente solicitou atendimento para realizar um orcamento.'
    end
  ) on conflict (message_sid) do nothing;

  if safe_body <> '' and safe_body not in ('2', '3') then
    insert into private.whatsapp_support_messages(thread_id, direction, body)
    values (thread_id, 'inbound', safe_body);
  end if;
  return thread_id;
end;
$$;

create or replace function public.server_append_whatsapp_support_message(
  requested_phone_hmac text,
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
  if safe_body = '' or char_length(coalesce(requested_message_sid, '')) not between 8 and 80 then
    raise exception 'Mensagem de atendimento invalida' using errcode = '22023';
  end if;
  select id into thread_id
  from private.whatsapp_support_threads
  where phone_hmac = requested_phone_hmac and status in ('waiting', 'open')
  for update;
  if not found then return null; end if;

  insert into private.whatsapp_support_messages(thread_id, message_sid, direction, body)
  values (thread_id, requested_message_sid, 'inbound', safe_body)
  on conflict (message_sid) do nothing;
  update private.whatsapp_support_threads
  set source_message_sid = requested_message_sid,
      updated_at = now(),
      last_message_at = now()
  where id = thread_id;
  return thread_id;
end;
$$;

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
    'source_message_sid', thread.source_message_sid,
    'assigned_staff_user_id', thread.assigned_staff_user_id,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', message.id,
        'direction', message.direction,
        'body', message.body,
        'staff_user_id', message.staff_user_id,
        'created_at', message.created_at
      ) order by message.created_at, message.id)
      from private.whatsapp_support_messages message
      where message.thread_id = thread.id
        and message.created_at >= now() - interval '30 days'
    ), '[]'::jsonb)
  )
  from private.whatsapp_support_threads thread
  where thread.id = requested_thread_id;
$$;

create or replace function public.server_add_whatsapp_support_reply(
  requested_thread_id uuid,
  requested_staff_user_id uuid,
  requested_message_sid text,
  requested_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_body text := left(btrim(coalesce(requested_body, '')), 4000);
begin
  if safe_body = '' or char_length(coalesce(requested_message_sid, '')) not between 8 and 80 then
    raise exception 'Resposta de atendimento invalida' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id and active
  ) then
    raise exception 'Operador invalido' using errcode = '42501';
  end if;
  insert into private.whatsapp_support_messages(
    thread_id, message_sid, direction, body, staff_user_id
  ) values (
    requested_thread_id, requested_message_sid, 'outbound', safe_body, requested_staff_user_id
  );
  update private.whatsapp_support_threads
  set status = 'open',
      assigned_staff_user_id = requested_staff_user_id,
      updated_at = now(),
      last_message_at = now()
  where id = requested_thread_id and status in ('waiting', 'open');
  if not found then
    raise exception 'Atendimento nao esta aberto' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.server_close_whatsapp_support_thread(
  requested_thread_id uuid,
  requested_staff_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  phone_hash text;
begin
  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id and active
  ) then
    raise exception 'Operador invalido' using errcode = '42501';
  end if;
  update private.whatsapp_support_threads
  set status = 'closed',
      assigned_staff_user_id = requested_staff_user_id,
      updated_at = now(),
      closed_at = now()
  where id = requested_thread_id and status in ('waiting', 'open')
  returning phone_hmac into phone_hash;
  return phone_hash;
end;
$$;

revoke all on function public.server_prepare_whatsapp_order_message(text,text)
  from public, anon, authenticated;
revoke all on function public.server_finish_whatsapp_order_message(text,text,text,text,text,jsonb,timestamptz,boolean)
  from public, anon, authenticated;
revoke all on function public.server_open_whatsapp_support_thread(text,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.server_append_whatsapp_support_message(text,text,text)
  from public, anon, authenticated;
revoke all on function public.server_list_whatsapp_support_threads()
  from public, anon, authenticated;
revoke all on function public.server_get_whatsapp_support_thread(uuid)
  from public, anon, authenticated;
revoke all on function public.server_add_whatsapp_support_reply(uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.server_close_whatsapp_support_thread(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.server_prepare_whatsapp_order_message(text,text) to service_role;
grant execute on function public.server_finish_whatsapp_order_message(text,text,text,text,text,jsonb,timestamptz,boolean) to service_role;
grant execute on function public.server_open_whatsapp_support_thread(text,text,text,text,text) to service_role;
grant execute on function public.server_append_whatsapp_support_message(text,text,text) to service_role;
grant execute on function public.server_list_whatsapp_support_threads() to service_role;
grant execute on function public.server_get_whatsapp_support_thread(uuid) to service_role;
grant execute on function public.server_add_whatsapp_support_reply(uuid,uuid,text,text) to service_role;
grant execute on function public.server_close_whatsapp_support_thread(uuid,uuid) to service_role;

commit;
