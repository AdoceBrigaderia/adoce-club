create table public.weekly_service_menu (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  channel_slug text not null references public.store_channels(slug) on update cascade,
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  quantity_planned integer check (quantity_planned is null or quantity_planned >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  status text not null default 'published'
    check (status in ('published', 'sold_out', 'hidden')),
  note text,
  created_by uuid references public.staff_members(user_id),
  updated_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_date, channel_slug, flavor_id),
  check (quantity_planned is null or quantity_reserved <= quantity_planned),
  check (channel_slug in ('online_orders', 'in_person'))
);

create index weekly_service_menu_date_channel_idx
  on public.weekly_service_menu(service_date, channel_slug)
  where status <> 'hidden';

create index weekly_service_menu_flavor_idx
  on public.weekly_service_menu(flavor_id, service_date);

create trigger weekly_service_menu_touch
  before update on public.weekly_service_menu
  for each row execute function private.touch_updated_at();

alter table public.weekly_service_menu enable row level security;

create policy weekly_service_menu_anon_read
  on public.weekly_service_menu
  for select
  to anon
  using (status in ('published', 'sold_out') and service_date >= current_date);

create policy weekly_service_menu_authenticated_read
  on public.weekly_service_menu
  for select
  to authenticated
  using (
    (status in ('published', 'sold_out') and service_date >= current_date)
    or private.is_manager()
  );

create policy weekly_service_menu_manager_insert
  on public.weekly_service_menu
  for insert
  to authenticated
  with check (private.is_manager());

create policy weekly_service_menu_manager_update
  on public.weekly_service_menu
  for update
  to authenticated
  using (private.is_manager())
  with check (private.is_manager());

create policy weekly_service_menu_manager_delete
  on public.weekly_service_menu
  for delete
  to authenticated
  using (private.is_manager());

grant select on table public.weekly_service_menu to anon, authenticated;
grant insert, update, delete on table public.weekly_service_menu to authenticated;
