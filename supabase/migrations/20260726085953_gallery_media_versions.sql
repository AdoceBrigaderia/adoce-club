begin;

create table if not exists public.gallery_media_versions (
  id uuid primary key default gen_random_uuid(),
  media_key text not null,
  media_kind text not null check (media_kind in ('flavor-image', 'commercial-image', 'commercial-instagram')),
  media_id uuid not null,
  owner_kind text not null check (owner_kind in ('flavor-gallery', 'commercial-product-gallery', 'commercial-segment-gallery')),
  owner_id text not null,
  label text not null,
  media_type text not null check (media_type in ('image', 'instagram')),
  image_url text,
  original_image_url text,
  external_url text,
  alt_text text not null default '',
  caption text not null default '',
  role text,
  sort_order integer not null default 0,
  active boolean not null default true,
  change_type text not null check (change_type in ('created', 'updated', 'deleted')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now(),
  constraint gallery_media_versions_source_check check (
    (media_type = 'image' and image_url is not null)
    or (media_type = 'instagram' and external_url is not null)
  )
);

create index if not exists gallery_media_versions_media_changed_idx
  on public.gallery_media_versions (media_key, changed_at desc);

create index if not exists gallery_media_versions_owner_changed_idx
  on public.gallery_media_versions (owner_kind, owner_id, changed_at desc);

alter table public.gallery_media_versions enable row level security;

drop policy if exists gallery_media_versions_manager_read
  on public.gallery_media_versions;
create policy gallery_media_versions_manager_read
  on public.gallery_media_versions
  for select
  to authenticated
  using ((select private.is_manager()));

grant select on public.gallery_media_versions to authenticated;

create or replace function private.capture_flavor_gallery_media_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text := private.dynamic_image_actor_name(actor_id);
  snapshot public.flavor_images%rowtype;
  snapshot_change_type text;
  flavor_name text;
begin
  if tg_op = 'DELETE' then
    snapshot := old;
    snapshot_change_type := 'deleted';
  elsif tg_op = 'INSERT' then
    snapshot := new;
    snapshot_change_type := 'created';
  else
    snapshot := new;
    snapshot_change_type := 'updated';
  end if;

  select f.name into flavor_name
  from public.flavors f
  where f.id = snapshot.flavor_id;

  insert into public.gallery_media_versions (
    media_key, media_kind, media_id, owner_kind, owner_id, label,
    media_type, image_url, original_image_url, external_url,
    alt_text, caption, role, sort_order, active,
    change_type, changed_by, changed_by_name
  ) values (
    'flavor-media:' || snapshot.id::text,
    'flavor-image',
    snapshot.id,
    'flavor-gallery',
    snapshot.flavor_id::text,
    coalesce('Sabor: ' || flavor_name, 'Galeria de sabor'),
    'image',
    snapshot.image_path,
    snapshot.original_image_path,
    null,
    snapshot.alt_text,
    coalesce(snapshot.caption, ''),
    snapshot.image_role,
    snapshot.sort_order,
    snapshot.active,
    snapshot_change_type,
    actor_id,
    actor_name
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.capture_flavor_gallery_media_version()
  from public, anon, authenticated;

drop trigger if exists capture_flavor_gallery_media_version on public.flavor_images;
create trigger capture_flavor_gallery_media_version
after insert or update of image_path, original_image_path, alt_text, caption, image_role, sort_order, active or delete
on public.flavor_images
for each row execute function private.capture_flavor_gallery_media_version();

create or replace function private.capture_commercial_gallery_media_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text;
  snapshot public.commercial_media_items%rowtype;
  snapshot_change_type text;
  resolved_owner_kind text;
  resolved_owner_id text;
  resolved_label text;
  resolved_media_kind text;
  product_name text;
  resolved_changed_by uuid;
begin
  if tg_op = 'DELETE' then
    snapshot := old;
    snapshot_change_type := 'deleted';
  elsif tg_op = 'INSERT' then
    snapshot := new;
    snapshot_change_type := 'created';
  else
    snapshot := new;
    snapshot_change_type := 'updated';
  end if;

  if snapshot.product_id is not null then
    resolved_owner_kind := 'commercial-product-gallery';
    resolved_owner_id := snapshot.product_id::text;
    select p.name into product_name
    from public.commercial_products p
    where p.id = snapshot.product_id;
    resolved_label := coalesce('Produto: ' || product_name, 'Galeria de produto');
  else
    resolved_owner_kind := 'commercial-segment-gallery';
    resolved_owner_id := snapshot.segment;
    resolved_label := 'Categoria: ' || coalesce(snapshot.segment, 'não identificada');
  end if;

  resolved_media_kind := case
    when snapshot.media_type = 'instagram' then 'commercial-instagram'
    else 'commercial-image'
  end;
  resolved_changed_by := coalesce(actor_id, snapshot.updated_by, snapshot.created_by);
  actor_name := private.dynamic_image_actor_name(resolved_changed_by);

  insert into public.gallery_media_versions (
    media_key, media_kind, media_id, owner_kind, owner_id, label,
    media_type, image_url, original_image_url, external_url,
    alt_text, caption, role, sort_order, active,
    change_type, changed_by, changed_by_name
  ) values (
    'commercial-media:' || snapshot.id::text,
    resolved_media_kind,
    snapshot.id,
    resolved_owner_kind,
    resolved_owner_id,
    resolved_label,
    snapshot.media_type,
    snapshot.image_url,
    snapshot.original_image_url,
    snapshot.external_url,
    snapshot.alt_text,
    snapshot.caption,
    null,
    snapshot.sort_order,
    snapshot.active,
    snapshot_change_type,
    resolved_changed_by,
    actor_name
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.capture_commercial_gallery_media_version()
  from public, anon, authenticated;

drop trigger if exists capture_commercial_gallery_media_version on public.commercial_media_items;
create trigger capture_commercial_gallery_media_version
after insert or update of segment, product_id, media_type, image_url, original_image_url, external_url, alt_text, caption, sort_order, active, updated_by or delete
on public.commercial_media_items
for each row execute function private.capture_commercial_gallery_media_version();

insert into public.gallery_media_versions (
  media_key, media_kind, media_id, owner_kind, owner_id, label,
  media_type, image_url, original_image_url, external_url,
  alt_text, caption, role, sort_order, active,
  change_type, changed_at
)
select
  'flavor-media:' || image.id::text,
  'flavor-image',
  image.id,
  'flavor-gallery',
  image.flavor_id::text,
  'Sabor: ' || flavor.name,
  'image',
  image.image_path,
  image.original_image_path,
  null,
  image.alt_text,
  coalesce(image.caption, ''),
  image.image_role,
  image.sort_order,
  image.active,
  'created',
  image.created_at
from public.flavor_images image
join public.flavors flavor on flavor.id = image.flavor_id
where not exists (
  select 1 from public.gallery_media_versions version
  where version.media_key = 'flavor-media:' || image.id::text
);

insert into public.gallery_media_versions (
  media_key, media_kind, media_id, owner_kind, owner_id, label,
  media_type, image_url, original_image_url, external_url,
  alt_text, caption, role, sort_order, active,
  change_type, changed_by, changed_by_name, changed_at
)
select
  'commercial-media:' || media.id::text,
  case when media.media_type = 'instagram' then 'commercial-instagram' else 'commercial-image' end,
  media.id,
  case when media.product_id is not null then 'commercial-product-gallery' else 'commercial-segment-gallery' end,
  coalesce(media.product_id::text, media.segment),
  case
    when media.product_id is not null then 'Produto: ' || product.name
    else 'Categoria: ' || coalesce(media.segment, 'não identificada')
  end,
  media.media_type,
  media.image_url,
  media.original_image_url,
  media.external_url,
  media.alt_text,
  media.caption,
  null,
  media.sort_order,
  media.active,
  'created',
  coalesce(media.updated_by, media.created_by),
  profile.full_name,
  media.created_at
from public.commercial_media_items media
left join public.commercial_products product on product.id = media.product_id
left join public.profiles profile on profile.id = coalesce(media.updated_by, media.created_by)
where not exists (
  select 1 from public.gallery_media_versions version
  where version.media_key = 'commercial-media:' || media.id::text
);

commit;
