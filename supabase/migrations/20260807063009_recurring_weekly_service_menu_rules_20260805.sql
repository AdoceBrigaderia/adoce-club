create table public.weekly_service_menu_rules (
  id uuid primary key default gen_random_uuid(),
  channel_slug text not null references public.store_channels(slug) on update cascade,
  flavor_id uuid not null references public.flavors(id) on delete cascade,
  weekdays smallint[] not null,
  quantity_planned integer not null check (quantity_planned between 0 and 9999),
  status text not null default 'published'
    check (status in ('published', 'sold_out', 'hidden')),
  note text,
  active boolean not null default true,
  created_by uuid references public.staff_members(user_id),
  updated_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_slug, flavor_id),
  check (cardinality(weekdays) between 1 and 7),
  check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (channel_slug in ('online_orders', 'in_person'))
);

create trigger weekly_service_menu_rules_touch
  before update on public.weekly_service_menu_rules
  for each row execute function private.touch_updated_at();

alter table public.weekly_service_menu_rules enable row level security;

create policy weekly_service_menu_rules_manager_read
  on public.weekly_service_menu_rules
  for select to authenticated
  using (private.is_manager());

create policy weekly_service_menu_rules_manager_insert
  on public.weekly_service_menu_rules
  for insert to authenticated
  with check (private.is_manager());

create policy weekly_service_menu_rules_manager_update
  on public.weekly_service_menu_rules
  for update to authenticated
  using (private.is_manager())
  with check (private.is_manager());

create policy weekly_service_menu_rules_manager_delete
  on public.weekly_service_menu_rules
  for delete to authenticated
  using (private.is_manager());

revoke all on table public.weekly_service_menu_rules from public, anon;
grant select, insert, update, delete on table public.weekly_service_menu_rules to authenticated;

alter table public.weekly_service_menu
  add column source_rule_id uuid references public.weekly_service_menu_rules(id) on delete set null;

create index weekly_service_menu_source_rule_idx
  on public.weekly_service_menu(source_rule_id, service_date)
  where source_rule_id is not null;
