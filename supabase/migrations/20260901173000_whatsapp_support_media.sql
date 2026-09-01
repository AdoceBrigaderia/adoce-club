begin;

-- Mídias ficam no Storage privado; a tabela guarda somente metadados e o caminho.
alter table private.whatsapp_support_messages
  add column if not exists media_kind text,
  add column if not exists media_storage_path text,
  add column if not exists media_content_type text,
  add column if not exists media_filename text,
  add column if not exists media_size_bytes integer,
  add column if not exists media_duration_seconds integer;

alter table private.whatsapp_support_messages
  drop constraint if exists whatsapp_support_messages_media_kind_check;
alter table private.whatsapp_support_messages
  add constraint whatsapp_support_messages_media_kind_check
  check (media_kind is null or media_kind in ('audio', 'image', 'video', 'document'));

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

comment on column private.whatsapp_support_messages.media_storage_path is
  'Caminho interno do arquivo no bucket privado whatsapp-support-media; nunca uma URL pública.';

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
        'created_at', message.created_at,
        'media_kind', message.media_kind,
        'media_storage_path', message.media_storage_path,
        'media_content_type', message.media_content_type,
        'media_filename', message.media_filename,
        'media_size_bytes', message.media_size_bytes,
        'media_duration_seconds', message.media_duration_seconds
      ) order by message.created_at, message.id)
      from private.whatsapp_support_messages message
      where message.thread_id = thread.id
        and message.created_at >= now() - interval '30 days'
    ), '[]'::jsonb)
  )
  from private.whatsapp_support_threads thread
  where thread.id = requested_thread_id;
$$;

create or replace function public.server_add_whatsapp_support_media(
  requested_thread_id uuid,
  requested_staff_user_id uuid,
  requested_message_sid text,
  requested_body text,
  requested_media_kind text,
  requested_media_storage_path text,
  requested_media_content_type text,
  requested_media_filename text,
  requested_media_size_bytes integer default null,
  requested_media_duration_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_body text := left(btrim(coalesce(requested_body, '')), 4000);
begin
  if not exists (
    select 1 from public.staff_members
    where user_id = requested_staff_user_id and active
  ) then
    raise exception 'Operador invalido' using errcode = '42501';
  end if;
  if requested_media_kind not in ('audio', 'image', 'video', 'document')
     or coalesce(requested_media_storage_path, '') = ''
     or char_length(coalesce(requested_message_sid, '')) not between 8 and 80
     or char_length(safe_body) > 4000 then
    raise exception 'Midia de atendimento invalida' using errcode = '22023';
  end if;
  insert into private.whatsapp_support_messages(
    thread_id, message_sid, direction, body, staff_user_id,
    media_kind, media_storage_path, media_content_type, media_filename,
    media_size_bytes, media_duration_seconds
  ) values (
    requested_thread_id, requested_message_sid, 'outbound', safe_body, requested_staff_user_id,
    requested_media_kind, requested_media_storage_path, requested_media_content_type,
    left(nullif(btrim(requested_media_filename), ''), 180),
    requested_media_size_bytes, requested_media_duration_seconds
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

revoke all on function public.server_add_whatsapp_support_media(uuid,uuid,text,text,text,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.server_add_whatsapp_support_media(uuid,uuid,text,text,text,text,text,text,integer,integer)
  to service_role;

commit;
