begin;

create table if not exists public.site_visual_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null,
  label text not null,
  section text not null,
  default_url text not null,
  image_url text not null,
  original_image_url text,
  alt_text text not null default '',
  active boolean not null default true,
  change_type text not null check (change_type in ('created', 'updated', 'deleted')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now(),
  constraint site_visual_asset_versions_key_check
    check (asset_key ~ '^/(site|adoce-hoje|wallet)/[a-zA-Z0-9._/-]+$'),
  constraint site_visual_asset_versions_image_url_check
    check (image_url ~ '^https?://'),
  constraint site_visual_asset_versions_default_url_check
    check (default_url ~ '^/')
);

create index if not exists site_visual_asset_versions_asset_changed_idx
  on public.site_visual_asset_versions (asset_key, changed_at desc);

alter table public.site_visual_asset_versions enable row level security;

drop policy if exists site_visual_asset_versions_manager_read
  on public.site_visual_asset_versions;
create policy site_visual_asset_versions_manager_read
  on public.site_visual_asset_versions
  for select
  to authenticated
  using ((select private.is_manager()));

grant select on public.site_visual_asset_versions to authenticated;

create or replace function private.capture_site_visual_asset_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text;
  snapshot public.site_visual_assets%rowtype;
  snapshot_change_type text;
begin
  if actor_id is not null then
    select p.full_name
      into actor_name
      from public.profiles p
      where p.id = actor_id;
  end if;

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

  insert into public.site_visual_asset_versions (
    asset_key,
    label,
    section,
    default_url,
    image_url,
    original_image_url,
    alt_text,
    active,
    change_type,
    changed_by,
    changed_by_name
  ) values (
    snapshot.asset_key,
    snapshot.label,
    snapshot.section,
    snapshot.default_url,
    snapshot.image_url,
    snapshot.original_image_url,
    snapshot.alt_text,
    snapshot.active,
    snapshot_change_type,
    coalesce(actor_id, snapshot.updated_by),
    actor_name
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.capture_site_visual_asset_version()
  from public, anon, authenticated;

drop trigger if exists capture_site_visual_asset_version
  on public.site_visual_assets;
create trigger capture_site_visual_asset_version
after insert or update or delete on public.site_visual_assets
for each row execute function private.capture_site_visual_asset_version();

insert into public.site_visual_asset_versions (
  asset_key,
  label,
  section,
  default_url,
  image_url,
  original_image_url,
  alt_text,
  active,
  change_type,
  changed_by,
  changed_by_name,
  changed_at
)
select
  asset.asset_key,
  asset.label,
  asset.section,
  asset.default_url,
  asset.image_url,
  asset.original_image_url,
  asset.alt_text,
  asset.active,
  'created',
  asset.updated_by,
  profile.full_name,
  asset.updated_at
from public.site_visual_assets asset
left join public.profiles profile on profile.id = asset.updated_by
where not exists (
  select 1
  from public.site_visual_asset_versions version
  where version.asset_key = asset.asset_key
);

commit;
