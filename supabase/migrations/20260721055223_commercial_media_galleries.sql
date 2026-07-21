create table if not exists public.commercial_media_items (
  id uuid primary key default gen_random_uuid(),
  segment text,
  product_id uuid references public.commercial_products(id) on delete cascade,
  media_type text not null default 'image',
  image_url text,
  original_image_url text,
  external_url text,
  alt_text text not null default '',
  caption text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_media_owner_check check ((segment is null) <> (product_id is null)),
  constraint commercial_media_segment_check check (segment is null or segment in ('cakes', 'sweets', 'events', 'school', 'rentals')),
  constraint commercial_media_type_check check (media_type in ('image', 'instagram')),
  constraint commercial_media_payload_check check (
    (media_type = 'image' and image_url is not null and external_url is null)
    or
    (media_type = 'instagram' and external_url ~ '^https://(www\.)?instagram\.com/(reel|p)/[A-Za-z0-9_-]+/?')
  )
);

create index if not exists commercial_media_items_segment_idx
  on public.commercial_media_items(segment, active, sort_order) where segment is not null;
create index if not exists commercial_media_items_product_idx
  on public.commercial_media_items(product_id, active, sort_order) where product_id is not null;

alter table public.commercial_media_items enable row level security;

create policy "commercial media is publicly readable"
on public.commercial_media_items for select
to anon, authenticated
using (
  active
  and (
    segment is not null
    or exists (
      select 1 from public.commercial_products product
      where product.id = product_id and product.active and product.published
    )
  )
);

create policy "managers can read all commercial media"
on public.commercial_media_items for select
to authenticated
using (private.is_manager());

create policy "managers can insert commercial media"
on public.commercial_media_items for insert
to authenticated
with check (private.is_manager());

create policy "managers can update commercial media"
on public.commercial_media_items for update
to authenticated
using (private.is_manager())
with check (private.is_manager());

create policy "managers can delete commercial media"
on public.commercial_media_items for delete
to authenticated
using (private.is_manager());

grant select on public.commercial_media_items to anon, authenticated;
grant insert, update, delete on public.commercial_media_items to authenticated;

drop trigger if exists commercial_media_items_touch on public.commercial_media_items;
create trigger commercial_media_items_touch
before update on public.commercial_media_items
for each row execute function private.touch_updated_at();

drop trigger if exists audit_content_change on public.commercial_media_items;
create trigger audit_content_change
after insert or update or delete on public.commercial_media_items
for each row execute function private.audit_content_change();

create or replace function private.enforce_commercial_media_limit()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_count integer;
  reel_count integer;
begin
  if not new.active then return new; end if;

  select count(*) into owner_count
  from public.commercial_media_items item
  where item.active
    and item.id <> new.id
    and ((new.segment is not null and item.segment = new.segment)
      or (new.product_id is not null and item.product_id = new.product_id));

  if owner_count >= 8 then
    raise exception 'Esta galeria já possui o limite de 8 mídias.';
  end if;

  if new.media_type = 'instagram' then
    select count(*) into reel_count
    from public.commercial_media_items item
    where item.active
      and item.media_type = 'instagram'
      and item.id <> new.id
      and ((new.segment is not null and item.segment = new.segment)
        or (new.product_id is not null and item.product_id = new.product_id));
    if reel_count >= 2 then
      raise exception 'Esta galeria já possui o limite de 2 Reels.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_media_limit_trigger on public.commercial_media_items;
create trigger commercial_media_limit_trigger
before insert or update of active, media_type, segment, product_id
on public.commercial_media_items
for each row execute function private.enforce_commercial_media_limit();

insert into public.commercial_media_items (
  segment, media_type, image_url, original_image_url, alt_text, sort_order, created_by, updated_by
)
select media.segment, 'image', media.image_url, media.original_image_url, media.alt_text, 10, null, media.updated_by
from public.commercial_segment_media media
where media.image_url is not null
  and not exists (
    select 1 from public.commercial_media_items item
    where item.segment = media.segment and item.image_url = media.image_url
  );

insert into public.commercial_media_items (
  product_id, media_type, image_url, original_image_url, alt_text, sort_order, created_by, updated_by
)
select product.id, 'image', product.image_url, product.original_image_url,
  'Foto real de ' || product.name, 10, product.created_by, product.updated_by
from public.commercial_products product
where product.image_url is not null
  and product.image_url not like '%instagram.com/%'
  and not exists (
    select 1 from public.commercial_media_items item
    where item.product_id = product.id and item.image_url = product.image_url
  );
