begin;

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists preferred_channel text
    check (preferred_channel is null or preferred_channel in ('email', 'whatsapp', 'both', 'none')),
  add column if not exists postal_code text,
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists city text default 'Fortaleza',
  add column if not exists state_code text default 'CE'
    check (state_code is null or char_length(state_code) = 2),
  add column if not exists flavor_preferences text[] not null default '{}'::text[];

grant update(
  full_name, birth_date, preferred_channel, postal_code, address_line,
  address_number, address_complement, neighborhood, city, state_code,
  flavor_preferences
) on public.profiles to authenticated;

alter table public.flavors
  add column if not exists base_price numeric(10,2)
    check (base_price is null or base_price >= 0),
  add column if not exists short_description text;

create table if not exists public.flavor_images (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  image_path text not null,
  alt_text text not null,
  image_role text not null default 'gallery'
    check (image_role in ('cover', 'slice', 'whole', 'sauce', 'gallery')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists flavor_images_flavor_idx
  on public.flavor_images(flavor_id, active, sort_order);
alter table public.flavor_images enable row level security;
drop policy if exists flavor_images_public_read on public.flavor_images;
create policy flavor_images_public_read on public.flavor_images
  for select to anon, authenticated using (active);
drop policy if exists flavor_images_staff_all on public.flavor_images;
create policy flavor_images_staff_all on public.flavor_images
  for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
grant select on public.flavor_images to anon, authenticated;
grant insert, update, delete on public.flavor_images to authenticated;

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  channel_slug text not null references public.store_channels(slug) on update cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_slug, weekday, opens_at)
);
alter table public.business_hours enable row level security;
drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours
  for select to anon, authenticated using (active);
drop policy if exists business_hours_staff_all on public.business_hours;
create policy business_hours_staff_all on public.business_hours
  for all to authenticated
  using (private.is_manager()) with check (private.is_manager());
grant select on public.business_hours to anon, authenticated;
grant insert, update, delete on public.business_hours to authenticated;

create table if not exists public.business_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  channel_slug text not null references public.store_channels(slug) on update cascade,
  service_date date not null,
  closed boolean not null default false,
  opens_at time,
  closes_at time,
  message text,
  created_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_slug, service_date),
  check (closed or (opens_at is not null and closes_at is not null))
);
alter table public.business_hour_exceptions enable row level security;
drop policy if exists hour_exceptions_public_read on public.business_hour_exceptions;
create policy hour_exceptions_public_read on public.business_hour_exceptions
  for select to anon, authenticated using (service_date >= current_date - 1);
drop policy if exists hour_exceptions_staff_all on public.business_hour_exceptions;
create policy hour_exceptions_staff_all on public.business_hour_exceptions
  for all to authenticated
  using (private.is_manager()) with check (private.is_manager());
grant select on public.business_hour_exceptions to anon, authenticated;
grant insert, update, delete on public.business_hour_exceptions to authenticated;

create or replace function public.staff_search_customers(search_text text default '')
returns table (
  profile_id uuid,
  account_id uuid,
  full_name text,
  phone_e164 text,
  email text,
  current_progress smallint,
  completed_cards integer,
  available_rewards bigint,
  available_reward_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  return query
  select
    p.id,
    a.id,
    p.full_name,
    p.phone_e164,
    p.email,
    t.current_progress,
    t.completed_cards,
    count(r.id) filter (where r.status = 'available')::bigint,
    min(r.id) filter (where r.status = 'available')
  from public.profiles p
  join public.account_memberships m
    on m.profile_id = p.id and m.active and m.is_primary
  join public.loyalty_accounts a on a.id = m.account_id and a.active
  join public.loyalty_tracks t on t.account_id = a.id and t.kind = 'main'
  left join public.rewards r on r.track_id = t.id
  where search_text is null
     or trim(search_text) = ''
     or lower(p.full_name) like '%' || lower(trim(search_text)) || '%'
     or coalesce(p.phone_e164, '') like '%' || regexp_replace(search_text, '[^0-9]', '', 'g') || '%'
     or lower(coalesce(p.email, '')) like '%' || lower(trim(search_text)) || '%'
  group by p.id, a.id, p.full_name, p.phone_e164, p.email,
           t.current_progress, t.completed_cards, p.updated_at
  order by p.updated_at desc
  limit 30;
end;
$$;
revoke all on function public.staff_search_customers(text) from public, anon;
grant execute on function public.staff_search_customers(text) to authenticated;

update public.loyalty_accounts a
set name = p.full_name, updated_at = now()
from public.profiles p
where a.owner_profile_id = p.id
  and p.email in ('fcorbz@gmail.com', 'beth.ciencias.bt@gmail.com');

insert into public.flavors(name, category, description, short_description, image_path, base_price, active, sort_order)
values
  ('Kinder Bueno', 'premium', 'Uma combinação intensa de chocolate, creme aveludado e a assinatura irresistível de Kinder Bueno.', 'Chocolate cremoso com Kinder Bueno.', '/adoce-hoje/kinder-bueno.webp', 20.00, true, 10),
  ('Trufado de Ninho com morangos', 'traditional', 'Chocolate trufado, creme de Ninho e morangos para equilibrar doçura e frescor em cada garfada.', 'Chocolate trufado, Ninho e morangos.', '/adoce-hoje/chocolatudo-morangos.webp', 16.00, true, 20),
  ('Red Velvet com Ninho e Nutella', 'traditional', 'Massa vermelha macia, creme de Ninho e Nutella em uma fatia cremosa e marcante.', 'Red Velvet, Ninho e Nutella.', '/adoce-hoje/red-velvet.webp', 16.00, true, 30),
  ('Chocolatudo', 'traditional', 'Massa de chocolate molhadinha com recheio generoso e cremoso para quem leva chocolate a sério.', 'Chocolate intenso e muito recheio.', '/adoce-hoje/chocolatudo.webp', 16.00, true, 40),
  ('Ferrero Rocher', 'traditional', 'Chocolate, creme e crocância em camadas inspiradas no clássico bombom.', 'Chocolate, creme e crocância.', '/adoce-hoje/ferrero-rocher.webp', 16.00, true, 50),
  ('Oreo', 'traditional', 'Massa de chocolate e creme delicado com o contraste crocante do biscoito Oreo.', 'Chocolate, creme e Oreo.', '/adoce-hoje/oreo.webp', 16.00, true, 60),
  ('Limão com frutas vermelhas', 'traditional', 'Leve acidez do limão, creme macio e frutas vermelhas numa fatia fresca e equilibrada.', 'Cítrica, cremosa e frutada.', '/adoce-hoje/limao-frutas-vermelhas.webp', 16.00, true, 70),
  ('Abacaxi com coco', 'traditional', 'Massa molhadinha, creme delicado, coco e pedacinhos de abacaxi.', 'Tropical, cremosa e molhadinha.', '/adoce-hoje/abacaxi-coco.webp', 16.00, true, 80)
on conflict (name) do update set
  category = excluded.category,
  description = excluded.description,
  short_description = excluded.short_description,
  image_path = excluded.image_path,
  base_price = excluded.base_price,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.flavor_images(flavor_id, image_path, alt_text, image_role, sort_order)
select f.id, f.image_path, 'Fatia de ' || f.name, 'cover', 0
from public.flavors f
where f.image_path is not null
  and not exists (
    select 1 from public.flavor_images i
    where i.flavor_id = f.id and i.image_role = 'cover'
  );

commit;
