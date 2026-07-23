create table if not exists public.site_visual_assets (
  asset_key text primary key,
  label text not null,
  section text not null,
  default_url text not null,
  image_url text not null,
  original_image_url text,
  alt_text text not null default '',
  active boolean not null default true,
  updated_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_visual_assets_key_check
    check (asset_key ~ '^/(site|adoce-hoje|wallet)/[a-zA-Z0-9._/-]+$'),
  constraint site_visual_assets_image_url_check
    check (image_url ~ '^https?://'),
  constraint site_visual_assets_default_url_check
    check (default_url ~ '^/')
);

create index if not exists site_visual_assets_section_idx
  on public.site_visual_assets (section, label);

alter table public.site_visual_assets enable row level security;

drop policy if exists site_visual_assets_anon_read on public.site_visual_assets;
create policy site_visual_assets_anon_read
  on public.site_visual_assets
  for select
  to anon
  using (active);

drop policy if exists site_visual_assets_authenticated_read on public.site_visual_assets;
create policy site_visual_assets_authenticated_read
  on public.site_visual_assets
  for select
  to authenticated
  using (active or (select private.is_manager()));

drop policy if exists site_visual_assets_manager_insert on public.site_visual_assets;
create policy site_visual_assets_manager_insert
  on public.site_visual_assets
  for insert
  to authenticated
  with check (
    (select private.is_manager())
    and updated_by = (select auth.uid())
  );

drop policy if exists site_visual_assets_manager_update on public.site_visual_assets;
create policy site_visual_assets_manager_update
  on public.site_visual_assets
  for update
  to authenticated
  using ((select private.is_manager()))
  with check (
    (select private.is_manager())
    and updated_by = (select auth.uid())
  );

drop policy if exists site_visual_assets_manager_delete on public.site_visual_assets;
create policy site_visual_assets_manager_delete
  on public.site_visual_assets
  for delete
  to authenticated
  using ((select private.is_manager()));

grant select on public.site_visual_assets to anon, authenticated;
grant insert, update, delete on public.site_visual_assets to authenticated;

create or replace function public.set_site_visual_asset_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_site_visual_asset_updated_at
  on public.site_visual_assets;
create trigger set_site_visual_asset_updated_at
before update on public.site_visual_assets
for each row execute function public.set_site_visual_asset_updated_at();
