begin;

create table if not exists public.dynamic_image_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null,
  asset_kind text not null check (asset_kind in ('flavor-cover', 'whole-cake', 'commercial-product', 'commercial-segment')),
  owner_id text not null,
  label text not null,
  image_url text not null,
  original_image_url text,
  change_type text not null check (change_type in ('created', 'updated', 'deleted')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now(),
  constraint dynamic_image_asset_versions_image_url_check
    check (image_url ~ '^(https?://|/)')
);

create index if not exists dynamic_image_asset_versions_asset_changed_idx
  on public.dynamic_image_asset_versions (asset_key, changed_at desc);

create index if not exists dynamic_image_asset_versions_owner_idx
  on public.dynamic_image_asset_versions (asset_kind, owner_id, changed_at desc);

alter table public.dynamic_image_asset_versions enable row level security;

drop policy if exists dynamic_image_asset_versions_manager_read
  on public.dynamic_image_asset_versions;
create policy dynamic_image_asset_versions_manager_read
  on public.dynamic_image_asset_versions
  for select
  to authenticated
  using ((select private.is_manager()));

grant select on public.dynamic_image_asset_versions to authenticated;

create or replace function private.dynamic_image_actor_name(actor_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select p.full_name from public.profiles p where p.id = actor_id;
$$;

revoke all on function private.dynamic_image_actor_name(uuid)
  from public, anon, authenticated;

create or replace function private.capture_flavor_image_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text := private.dynamic_image_actor_name(actor_id);
  snapshot public.flavors%rowtype;
  snapshot_change_type text;
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

  if tg_op <> 'UPDATE' or old.image_path is distinct from new.image_path then
    insert into public.dynamic_image_asset_versions (
      asset_key, asset_kind, owner_id, label, image_url, original_image_url,
      change_type, changed_by, changed_by_name
    ) values (
      'flavor:' || snapshot.id::text || ':cover',
      'flavor-cover',
      snapshot.id::text,
      'Sabor: ' || snapshot.name,
      coalesce(nullif(btrim(snapshot.image_path), ''), '/site/placeholder-sabor-sem-foto.svg'),
      null,
      snapshot_change_type,
      actor_id,
      actor_name
    );
  end if;

  if (tg_op <> 'UPDATE' and (snapshot.whole_cake_available or snapshot.whole_cake_image_path is not null))
     or (tg_op = 'UPDATE' and (
       old.whole_cake_image_path is distinct from new.whole_cake_image_path
       or old.whole_cake_original_image_path is distinct from new.whole_cake_original_image_path
       or old.whole_cake_available is distinct from new.whole_cake_available
     )) then
    insert into public.dynamic_image_asset_versions (
      asset_key, asset_kind, owner_id, label, image_url, original_image_url,
      change_type, changed_by, changed_by_name
    ) values (
      'flavor:' || snapshot.id::text || ':whole-cake',
      'whole-cake',
      snapshot.id::text,
      'Torta inteira: ' || snapshot.name,
      coalesce(nullif(btrim(snapshot.whole_cake_image_path), ''), '/site/placeholder-torta-sem-foto.svg'),
      snapshot.whole_cake_original_image_path,
      snapshot_change_type,
      actor_id,
      actor_name
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.capture_flavor_image_versions()
  from public, anon, authenticated;

drop trigger if exists capture_flavor_image_versions on public.flavors;
create trigger capture_flavor_image_versions
after insert or update of image_path, whole_cake_image_path, whole_cake_original_image_path, whole_cake_available or delete
on public.flavors
for each row execute function private.capture_flavor_image_versions();

create or replace function private.capture_commercial_product_image_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text := private.dynamic_image_actor_name(actor_id);
  snapshot public.commercial_products%rowtype;
  snapshot_change_type text;
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

  if tg_op <> 'UPDATE'
     or old.image_url is distinct from new.image_url
     or old.original_image_url is distinct from new.original_image_url then
    insert into public.dynamic_image_asset_versions (
      asset_key, asset_kind, owner_id, label, image_url, original_image_url,
      change_type, changed_by, changed_by_name
    ) values (
      'product:' || snapshot.id::text || ':cover',
      'commercial-product',
      snapshot.id::text,
      'Produto: ' || snapshot.name,
      coalesce(nullif(btrim(snapshot.image_url), ''),
        case when snapshot.segment = 'cakes'
          then '/site/placeholder-torta-sem-foto.svg'
          else '/site/placeholder-produto-sem-foto.svg'
        end),
      snapshot.original_image_url,
      snapshot_change_type,
      coalesce(actor_id, snapshot.updated_by),
      actor_name
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.capture_commercial_product_image_versions()
  from public, anon, authenticated;

drop trigger if exists capture_commercial_product_image_versions on public.commercial_products;
create trigger capture_commercial_product_image_versions
after insert or update of image_url, original_image_url or delete
on public.commercial_products
for each row execute function private.capture_commercial_product_image_versions();

create or replace function private.capture_commercial_segment_image_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text := private.dynamic_image_actor_name(actor_id);
  snapshot public.commercial_segment_media%rowtype;
  snapshot_change_type text;
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

  if tg_op <> 'UPDATE'
     or old.image_url is distinct from new.image_url
     or old.original_image_url is distinct from new.original_image_url then
    insert into public.dynamic_image_asset_versions (
      asset_key, asset_kind, owner_id, label, image_url, original_image_url,
      change_type, changed_by, changed_by_name
    ) values (
      'segment:' || snapshot.segment || ':cover',
      'commercial-segment',
      snapshot.segment,
      'Categoria: ' || snapshot.segment,
      snapshot.image_url,
      snapshot.original_image_url,
      snapshot_change_type,
      coalesce(actor_id, snapshot.updated_by),
      actor_name
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.capture_commercial_segment_image_versions()
  from public, anon, authenticated;

drop trigger if exists capture_commercial_segment_image_versions on public.commercial_segment_media;
create trigger capture_commercial_segment_image_versions
after insert or update of image_url, original_image_url or delete
on public.commercial_segment_media
for each row execute function private.capture_commercial_segment_image_versions();

insert into public.dynamic_image_asset_versions (
  asset_key, asset_kind, owner_id, label, image_url, original_image_url,
  change_type, changed_at
)
select
  'flavor:' || f.id::text || ':cover',
  'flavor-cover',
  f.id::text,
  'Sabor: ' || f.name,
  coalesce(nullif(btrim(f.image_path), ''), '/site/placeholder-sabor-sem-foto.svg'),
  null,
  'created',
  f.created_at
from public.flavors f
where not exists (
  select 1 from public.dynamic_image_asset_versions v
  where v.asset_key = 'flavor:' || f.id::text || ':cover'
);

insert into public.dynamic_image_asset_versions (
  asset_key, asset_kind, owner_id, label, image_url, original_image_url,
  change_type, changed_at
)
select
  'flavor:' || f.id::text || ':whole-cake',
  'whole-cake',
  f.id::text,
  'Torta inteira: ' || f.name,
  coalesce(nullif(btrim(f.whole_cake_image_path), ''), '/site/placeholder-torta-sem-foto.svg'),
  f.whole_cake_original_image_path,
  'created',
  f.created_at
from public.flavors f
where (f.whole_cake_available or f.whole_cake_image_path is not null)
  and not exists (
    select 1 from public.dynamic_image_asset_versions v
    where v.asset_key = 'flavor:' || f.id::text || ':whole-cake'
  );

insert into public.dynamic_image_asset_versions (
  asset_key, asset_kind, owner_id, label, image_url, original_image_url,
  change_type, changed_by, changed_by_name, changed_at
)
select
  'product:' || p.id::text || ':cover',
  'commercial-product',
  p.id::text,
  'Produto: ' || p.name,
  coalesce(nullif(btrim(p.image_url), ''),
    case when p.segment = 'cakes'
      then '/site/placeholder-torta-sem-foto.svg'
      else '/site/placeholder-produto-sem-foto.svg'
    end),
  p.original_image_url,
  'created',
  p.updated_by,
  profile.full_name,
  p.created_at
from public.commercial_products p
left join public.profiles profile on profile.id = p.updated_by
where not exists (
  select 1 from public.dynamic_image_asset_versions v
  where v.asset_key = 'product:' || p.id::text || ':cover'
);

insert into public.dynamic_image_asset_versions (
  asset_key, asset_kind, owner_id, label, image_url, original_image_url,
  change_type, changed_by, changed_by_name, changed_at
)
select
  'segment:' || s.segment || ':cover',
  'commercial-segment',
  s.segment,
  'Categoria: ' || s.segment,
  s.image_url,
  s.original_image_url,
  'created',
  s.updated_by,
  profile.full_name,
  s.created_at
from public.commercial_segment_media s
left join public.profiles profile on profile.id = s.updated_by
where not exists (
  select 1 from public.dynamic_image_asset_versions v
  where v.asset_key = 'segment:' || s.segment || ':cover'
);

commit;
