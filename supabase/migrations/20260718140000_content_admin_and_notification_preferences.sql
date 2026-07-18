begin;

-- Limites editoriais usados pela administração do Adoce Hoje.
alter table public.flavors
  add column if not exists ingredients text,
  drop constraint if exists flavors_name_length,
  drop constraint if exists flavors_short_description_length,
  drop constraint if exists flavors_description_length,
  drop constraint if exists flavors_ingredients_length;

alter table public.flavors
  add constraint flavors_name_length check (char_length(name) between 2 and 60),
  add constraint flavors_short_description_length
    check (short_description is null or char_length(short_description) <= 90),
  add constraint flavors_description_length
    check (description is null or char_length(description) <= 300),
  add constraint flavors_ingredients_length
    check (ingredients is null or char_length(ingredients) <= 400);

alter table public.flavor_images
  add column if not exists caption text,
  drop constraint if exists flavor_images_caption_length;

alter table public.flavor_images
  add constraint flavor_images_caption_length
    check (caption is null or char_length(caption) <= 120);

-- Preferências explícitas: participar do Clube não autoriza marketing.
create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  flavors boolean not null default true,
  festival boolean not null default true,
  promotions boolean not null default true,
  club_news boolean not null default true,
  rewards boolean not null default true,
  birthday boolean not null default false,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_read_own
  on public.notification_preferences;
create policy notification_preferences_read_own
  on public.notification_preferences for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_manager());

drop policy if exists notification_preferences_insert_own
  on public.notification_preferences;
create policy notification_preferences_insert_own
  on public.notification_preferences for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists notification_preferences_update_own
  on public.notification_preferences;
create policy notification_preferences_update_own
  on public.notification_preferences for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update on public.notification_preferences to authenticated;

-- Fila editorial. O envio efetivo usa somente canais configurados e consentidos.
create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  body text not null check (char_length(body) between 2 and 240),
  topic text not null check (
    topic in ('flavors', 'festival', 'promotions', 'club_news', 'rewards', 'birthday')
  ),
  channels text[] not null default '{push}'::text[],
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channels <@ array['push', 'email', 'whatsapp']::text[])
);

alter table public.notification_campaigns enable row level security;

drop policy if exists notification_campaigns_manager_all
  on public.notification_campaigns;
create policy notification_campaigns_manager_all
  on public.notification_campaigns for all to authenticated
  using (private.is_manager()) with check (private.is_manager());

grant select, insert, update, delete on public.notification_campaigns
  to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_notification_preferences
  on public.notification_preferences;
create trigger touch_notification_preferences
  before update on public.notification_preferences
  for each row execute function private.touch_updated_at();

drop trigger if exists touch_notification_campaigns
  on public.notification_campaigns;
create trigger touch_notification_campaigns
  before update on public.notification_campaigns
  for each row execute function private.touch_updated_at();

-- Bucket público apenas para mídia editorial. O arquivo original é normalizado
-- no navegador antes do envio (WebP, até 1600 px e no máximo 4 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adoce-media',
  'adoce-media',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists adoce_media_public_read on storage.objects;
create policy adoce_media_public_read
  on storage.objects for select to public
  using (bucket_id = 'adoce-media');

drop policy if exists adoce_media_manager_insert on storage.objects;
create policy adoce_media_manager_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'adoce-media' and private.is_manager());

drop policy if exists adoce_media_manager_update on storage.objects;
create policy adoce_media_manager_update
  on storage.objects for update to authenticated
  using (bucket_id = 'adoce-media' and private.is_manager())
  with check (bucket_id = 'adoce-media' and private.is_manager());

drop policy if exists adoce_media_manager_delete on storage.objects;
create policy adoce_media_manager_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'adoce-media' and private.is_manager());

-- Registro automático de alterações de conteúdo, preservando a trilha oficial.
create or replace function private.enforce_flavor_image_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active and (
    select count(*)
    from public.flavor_images image
    where image.flavor_id = new.flavor_id
      and image.active
      and (tg_op = 'INSERT' or image.id <> new.id)
  ) >= 6 then
    raise exception 'Cada produto pode ter no máximo 6 fotos ativas.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_flavor_image_limit
  on public.flavor_images;
create trigger enforce_flavor_image_limit
  before insert or update of active, flavor_id on public.flavor_images
  for each row execute function private.enforce_flavor_image_limit();

create or replace function private.audit_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    jsonb_build_object(
      'before', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'after', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'flavors', 'flavor_images', 'flavor_availability', 'store_channels',
    'business_hours', 'business_hour_exceptions', 'promotions',
    'notification_campaigns'
  ]
  loop
    execute format('drop trigger if exists audit_content_change on public.%I', table_name);
    execute format(
      'create trigger audit_content_change after insert or update or delete on public.%I for each row execute function private.audit_content_change()',
      table_name
    );
  end loop;
end;
$$;

commit;
