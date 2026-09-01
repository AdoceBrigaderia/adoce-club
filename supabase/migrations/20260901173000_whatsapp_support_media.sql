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

commit;
