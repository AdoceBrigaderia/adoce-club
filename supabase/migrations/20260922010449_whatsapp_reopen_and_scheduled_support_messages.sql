-- Reopen accidentally closed chats and allow staff to schedule future replies.
create table if not exists private.whatsapp_scheduled_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references private.whatsapp_support_threads(id) on delete cascade,
  staff_user_id uuid not null references public.staff_members(user_id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  message_sid text,
  last_error text,
  locked_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_scheduled_support_due_idx
  on private.whatsapp_scheduled_support_messages(scheduled_at, created_at)
  where status = 'pending';

create index if not exists whatsapp_scheduled_support_thread_idx
  on private.whatsapp_scheduled_support_messages(thread_id, status, scheduled_at);

alter table private.whatsapp_scheduled_support_messages enable row level security;
revoke all on table private.whatsapp_scheduled_support_messages from public, anon, authenticated;
grant select, insert, update, delete on table private.whatsapp_scheduled_support_messages to service_role;

comment on table private.whatsapp_scheduled_support_messages is
  'Private queue of staff-written WhatsApp support replies scheduled for future delivery by the official number.';

create or replace function public.server_reopen_whatsapp_support_chat(
  requested_thread_id uuid,
  requested_staff_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target private.whatsapp_support_threads%rowtype;
begin
  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id
      and active
      and role in ('owner', 'manager')
  ) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  select * into target
  from private.whatsapp_support_threads
  where id = requested_thread_id
  for update;

  if not found then
    raise exception 'Conversa não encontrada';
  end if;

  update private.whatsapp_support_threads
  set status = 'open',
      automation_mode = 'human',
      assigned_staff_user_id = requested_staff_user_id,
      closed_at = null,
      updated_at = clock_timestamp(),
      last_message_at = clock_timestamp()
  where id = target.id;

  insert into private.whatsapp_support_messages(thread_id, direction, body, author_kind, staff_user_id)
  values (target.id, 'system', 'Conversa reaberta pela equipe. Robô pausado.', 'system', requested_staff_user_id);

  return jsonb_build_object('reopened', true);
end;
$$;

revoke all on function public.server_reopen_whatsapp_support_chat(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_reopen_whatsapp_support_chat(uuid, uuid) to service_role;

create or replace function public.server_start_whatsapp_support_conversation(
  requested_phone_hmac text,
  requested_phone_last4 text,
  requested_message_sid text,
  requested_body text,
  requested_staff_user_id uuid
)
returns jsonb
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
     or char_length(coalesce(requested_message_sid, '')) not between 8 and 80
     or char_length(safe_body) < 1 then
    raise exception 'Conversa inválida' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id and active
  ) then
    raise exception 'Operador inválido' using errcode = '42501';
  end if;

  insert into private.whatsapp_support_threads(
    phone_hmac, phone_last4, department, status, source_message_sid,
    automation_mode, assigned_staff_user_id, updated_at, last_message_at, closed_at
  )
  values (
    requested_phone_hmac, requested_phone_last4, 'quote', 'open', requested_message_sid,
    'human', requested_staff_user_id, clock_timestamp(), clock_timestamp(), null
  )
  on conflict (phone_hmac) do update set
    phone_last4 = excluded.phone_last4,
    department = excluded.department,
    status = 'open',
    source_message_sid = excluded.source_message_sid,
    automation_mode = 'human',
    assigned_staff_user_id = requested_staff_user_id,
    updated_at = clock_timestamp(),
    last_message_at = clock_timestamp(),
    closed_at = null
  returning id into thread_id;

  insert into private.whatsapp_support_messages(thread_id, message_sid, direction, body, staff_user_id, author_kind)
  values (thread_id, requested_message_sid, 'outbound', safe_body, requested_staff_user_id, 'staff')
  on conflict (message_sid) do nothing;

  return jsonb_build_object('id', thread_id, 'started', true);
end;
$$;

revoke all on function public.server_start_whatsapp_support_conversation(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.server_start_whatsapp_support_conversation(text, text, text, text, uuid) to service_role;

create or replace function public.server_schedule_whatsapp_support_message(
  requested_thread_id uuid,
  requested_staff_user_id uuid,
  requested_body text,
  requested_scheduled_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target private.whatsapp_support_threads%rowtype;
  scheduled private.whatsapp_scheduled_support_messages%rowtype;
  safe_body text := left(btrim(coalesce(requested_body, '')), 4000);
begin
  if char_length(safe_body) < 1 then
    raise exception 'Escreva a mensagem antes de agendar' using errcode = '22023';
  end if;

  if requested_scheduled_at < now() + interval '1 minute'
     or requested_scheduled_at > now() + interval '90 days' then
    raise exception 'Escolha uma data futura de até 90 dias' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id and active
  ) then
    raise exception 'Operador inválido' using errcode = '42501';
  end if;

  select * into target
  from private.whatsapp_support_threads
  where id = requested_thread_id and status <> 'closed'
  for update;

  if not found then
    raise exception 'Reabra a conversa antes de agendar uma mensagem';
  end if;

  if target.automation_mode <> 'human'
     or target.assigned_staff_user_id is distinct from requested_staff_user_id then
    raise exception 'Assuma a conversa antes de agendar a mensagem';
  end if;

  insert into private.whatsapp_scheduled_support_messages(thread_id, staff_user_id, body, scheduled_at)
  values (target.id, requested_staff_user_id, safe_body, requested_scheduled_at)
  returning * into scheduled;

  insert into private.whatsapp_support_messages(thread_id, direction, body, author_kind, staff_user_id)
  values (
    target.id,
    'system',
    'Mensagem programada pela equipe para envio futuro.',
    'system',
    requested_staff_user_id
  );

  update private.whatsapp_support_threads
  set updated_at = clock_timestamp(),
      last_message_at = clock_timestamp()
  where id = target.id;

  return jsonb_build_object('scheduled', true, 'id', scheduled.id);
end;
$$;

revoke all on function public.server_schedule_whatsapp_support_message(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.server_schedule_whatsapp_support_message(uuid, uuid, text, timestamptz) to service_role;

create or replace function public.server_cancel_whatsapp_scheduled_message(
  requested_message_id uuid,
  requested_staff_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled private.whatsapp_scheduled_support_messages%rowtype;
begin
  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id and active
  ) then
    raise exception 'Operador inválido' using errcode = '42501';
  end if;

  select * into scheduled
  from private.whatsapp_scheduled_support_messages
  where id = requested_message_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Mensagem programada não encontrada';
  end if;

  update private.whatsapp_scheduled_support_messages
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = scheduled.id;

  insert into private.whatsapp_support_messages(thread_id, direction, body, author_kind, staff_user_id)
  values (scheduled.thread_id, 'system', 'Mensagem programada cancelada pela equipe.', 'system', requested_staff_user_id);

  update private.whatsapp_support_threads
  set updated_at = clock_timestamp(),
      last_message_at = clock_timestamp()
  where id = scheduled.thread_id;

  return jsonb_build_object('cancelled', true);
end;
$$;

revoke all on function public.server_cancel_whatsapp_scheduled_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_cancel_whatsapp_scheduled_message(uuid, uuid) to service_role;

create or replace function public.server_claim_due_whatsapp_support_messages(batch_size integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  with picked as (
    select scheduled.id
    from private.whatsapp_scheduled_support_messages scheduled
    join private.whatsapp_support_threads thread on thread.id = scheduled.thread_id
    where scheduled.status = 'pending'
      and scheduled.scheduled_at <= now()
      and thread.status <> 'closed'
    order by scheduled.scheduled_at, scheduled.created_at
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 10), 25))
  ),
  updated as (
    update private.whatsapp_scheduled_support_messages scheduled
    set status = 'processing',
        attempts = scheduled.attempts + 1,
        locked_at = clock_timestamp(),
        updated_at = clock_timestamp()
    from picked
    where scheduled.id = picked.id
    returning scheduled.id, scheduled.thread_id, scheduled.staff_user_id, scheduled.body,
      scheduled.attempts, scheduled.scheduled_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', updated.id,
    'thread_id', updated.thread_id,
    'staff_user_id', updated.staff_user_id,
    'body', updated.body,
    'attempts', updated.attempts,
    'scheduled_at', updated.scheduled_at,
    'source_message_sid', thread.source_message_sid
  ) order by updated.scheduled_at), '[]'::jsonb)
  into claimed
  from updated
  join private.whatsapp_support_threads thread on thread.id = updated.thread_id;

  return claimed;
end;
$$;

revoke all on function public.server_claim_due_whatsapp_support_messages(integer) from public, anon, authenticated;
grant execute on function public.server_claim_due_whatsapp_support_messages(integer) to service_role;

create or replace function public.server_complete_whatsapp_scheduled_message(
  requested_message_id uuid,
  requested_message_sid text,
  requested_success boolean,
  requested_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled private.whatsapp_scheduled_support_messages%rowtype;
  retry_at timestamptz;
begin
  select * into scheduled
  from private.whatsapp_scheduled_support_messages
  where id = requested_message_id and status = 'processing'
  for update;

  if not found then
    return jsonb_build_object('ignored', true);
  end if;

  if requested_success then
    update private.whatsapp_scheduled_support_messages
    set status = 'sent',
        message_sid = nullif(requested_message_sid, ''),
        sent_at = clock_timestamp(),
        updated_at = clock_timestamp(),
        last_error = null
    where id = scheduled.id;

    insert into private.whatsapp_support_messages(thread_id, message_sid, direction, body, staff_user_id, author_kind)
    values (
      scheduled.thread_id,
      nullif(left(coalesce(requested_message_sid, ''), 80), ''),
      'outbound',
      scheduled.body,
      scheduled.staff_user_id,
      'staff'
    )
    on conflict (message_sid) do nothing;

    update private.whatsapp_support_threads
    set updated_at = clock_timestamp(),
        last_message_at = clock_timestamp()
    where id = scheduled.thread_id;

    return jsonb_build_object('sent', true);
  end if;

  if scheduled.attempts < 3 then
    retry_at := now() + interval '5 minutes';
    update private.whatsapp_scheduled_support_messages
    set status = 'pending',
        scheduled_at = retry_at,
        last_error = left(coalesce(requested_error, 'Erro no envio'), 500),
        updated_at = clock_timestamp()
    where id = scheduled.id;

    return jsonb_build_object('retry', true, 'scheduled_at', retry_at);
  end if;

  update private.whatsapp_scheduled_support_messages
  set status = 'failed',
      last_error = left(coalesce(requested_error, 'Erro no envio'), 500),
      updated_at = clock_timestamp()
  where id = scheduled.id;

  insert into private.whatsapp_support_messages(thread_id, direction, body, staff_user_id, author_kind)
  values (
    scheduled.thread_id,
    'system',
    'Falha ao enviar mensagem programada. Confira a conversa antes de reenviar.',
    scheduled.staff_user_id,
    'system'
  );

  update private.whatsapp_support_threads
  set updated_at = clock_timestamp(),
      last_message_at = clock_timestamp()
  where id = scheduled.thread_id;

  return jsonb_build_object('failed', true);
end;
$$;

revoke all on function public.server_complete_whatsapp_scheduled_message(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.server_complete_whatsapp_scheduled_message(uuid, text, boolean, text) to service_role;

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
    'scheduled_messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', scheduled.id,
        'body', scheduled.body,
        'scheduled_at', scheduled.scheduled_at,
        'status', scheduled.status,
        'attempts', scheduled.attempts,
        'last_error', scheduled.last_error,
        'created_at', scheduled.created_at
      ) order by scheduled.scheduled_at, scheduled.created_at)
      from private.whatsapp_scheduled_support_messages scheduled
      where scheduled.thread_id = thread.id
        and scheduled.status in ('pending', 'processing', 'failed')
    ), '[]'::jsonb),
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

revoke all on function public.server_get_whatsapp_support_thread(uuid) from public, anon, authenticated;
grant execute on function public.server_get_whatsapp_support_thread(uuid) to service_role;

create or replace function public.server_end_whatsapp_support_chat(
  requested_thread_id uuid,
  requested_staff_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target private.whatsapp_support_threads%rowtype;
begin
  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id
      and active
      and role in ('owner', 'manager')
  ) then
    raise exception 'Acesso não autorizado';
  end if;

  select * into target
  from private.whatsapp_support_threads
  where id = requested_thread_id
  for update;

  if not found then
    raise exception 'Conversa não encontrada';
  end if;

  if target.status = 'closed' then
    return jsonb_build_object('closed', true);
  end if;

  perform public.server_close_whatsapp_support_thread(target.id, requested_staff_user_id);
  perform public.server_clear_whatsapp_order_conversation(target.phone_hmac);

  update private.whatsapp_scheduled_support_messages
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      updated_at = clock_timestamp(),
      last_error = 'Conversa encerrada antes do envio'
  where thread_id = target.id
    and status in ('pending', 'processing');

  insert into private.whatsapp_support_messages(thread_id, direction, body, author_kind, staff_user_id)
  values(target.id, 'system', 'Chat encerrado pela equipe. Histórico preservado.', 'system', requested_staff_user_id);

  return jsonb_build_object('closed', true);
end;
$$;

revoke all on function public.server_end_whatsapp_support_chat(uuid, uuid) from public, anon, authenticated;
grant execute on function public.server_end_whatsapp_support_chat(uuid, uuid) to service_role;
