begin;

create table public.staff_private_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 3 and 120),
  nickname text not null default '' check (char_length(nickname) <= 80),
  job_title text not null default '' check (char_length(job_title) <= 120),
  hired_on date,
  active boolean not null default true,
  mobile_phone text not null check (mobile_phone ~ '^55[1-9][0-9]{9,10}$'),
  alternate_phone text not null default '' check (alternate_phone = '' or alternate_phone ~ '^55[1-9][0-9]{9,10}$'),
  postal_code text not null default '' check (postal_code = '' or postal_code ~ '^[0-9]{8}$'),
  street text not null default '' check (char_length(street) <= 160),
  street_number text not null default '' check (char_length(street_number) <= 30),
  address_complement text not null default '' check (char_length(address_complement) <= 120),
  neighborhood text not null default '' check (char_length(neighborhood) <= 120),
  city text not null default '' check (char_length(city) <= 120),
  state_code text not null default '' check (state_code = '' or state_code ~ '^[A-Z]{2}$'),
  notes text not null default '' check (char_length(notes) <= 4000),
  avatar_path text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_private_emails (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_private_profiles(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (staff_profile_id, email)
);

create unique index staff_private_emails_one_primary_per_person_idx
  on public.staff_private_emails (staff_profile_id)
  where is_primary;

create unique index staff_private_emails_primary_unique_in_system_idx
  on public.staff_private_emails (email)
  where is_primary;

create index staff_private_profiles_user_id_idx on public.staff_private_profiles(user_id);
create index staff_private_profiles_name_idx on public.staff_private_profiles(lower(full_name));
create index staff_private_emails_profile_idx on public.staff_private_emails(staff_profile_id);

alter table public.staff_private_profiles enable row level security;
alter table public.staff_private_emails enable row level security;

revoke all on table public.staff_private_profiles from public, anon, authenticated;
revoke all on table public.staff_private_emails from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_private_profiles to authenticated;
grant select, insert, update, delete on table public.staff_private_emails to authenticated;

create policy staff_private_profiles_owner_select
  on public.staff_private_profiles for select to authenticated
  using ((select private.is_owner()) or user_id = (select auth.uid()));

create policy staff_private_profiles_owner_insert
  on public.staff_private_profiles for insert to authenticated
  with check (
    (select private.is_owner())
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy staff_private_profiles_owner_update
  on public.staff_private_profiles for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()) and updated_by = (select auth.uid()));

create policy staff_private_profiles_owner_delete
  on public.staff_private_profiles for delete to authenticated
  using ((select private.is_owner()));

create policy staff_private_emails_owner_all
  on public.staff_private_emails
  for all to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-profile-media',
  'staff-profile-media',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy staff_profile_media_owner_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'staff-profile-media'
    and (
      (select private.is_owner())
      or exists (
        select 1 from public.staff_private_profiles profile
        where profile.user_id = (select auth.uid())
          and (storage.foldername(name))[1] = profile.id::text
      )
    )
  );

create policy staff_profile_media_owner_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-profile-media' and (select private.is_owner()));

create policy staff_profile_media_owner_update
  on storage.objects for update to authenticated
  using (bucket_id = 'staff-profile-media' and (select private.is_owner()))
  with check (bucket_id = 'staff-profile-media' and (select private.is_owner()));

create policy staff_profile_media_owner_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'staff-profile-media' and (select private.is_owner()));

create or replace function public.owner_set_staff_access(
  target_user_id uuid,
  next_role text,
  next_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.staff_members%rowtype;
begin
  if not private.is_owner() then raise exception 'Somente proprietarios podem alterar acessos da equipe'; end if;
  if next_role not in ('owner', 'attendant', 'production') then raise exception 'Papel de acesso invalido'; end if;
  if target_user_id = (select auth.uid()) and not next_active then raise exception 'Voce nao pode remover o proprio acesso'; end if;

  update public.staff_members
  set role = next_role::public.staff_role, active = next_active
  where user_id = target_user_id
  returning * into target;
  if target.user_id is null then raise exception 'Conta de acesso nao encontrada'; end if;

  if next_active and next_role in ('attendant', 'production') then
    insert into public.staff_store_assignments(staff_user_id, store_id, active, created_by, updated_by)
    select target_user_id, store.id, true, (select auth.uid()), (select auth.uid())
    from public.stores store where store.active
    on conflict (staff_user_id, store_id) do update
      set active = true, updated_by = (select auth.uid()), updated_at = now();
  end if;

  if next_active and next_role = 'attendant' then
    update public.staff_store_assignments set
      active = true, can_sell = true, can_open_cash = true, can_close_cash = false,
      can_manage_stock = false, can_view_finance = false, can_manage_customers = true,
      can_manage_orders = true, can_manage_production = false, can_view_reports = false,
      can_manage_settings = false, updated_by = (select auth.uid()), updated_at = now()
    where staff_user_id = target_user_id;
  elsif next_active and next_role = 'production' then
    update public.staff_store_assignments set
      active = true, can_sell = false, can_open_cash = false, can_close_cash = false,
      can_manage_stock = true, can_view_finance = false, can_manage_customers = false,
      can_manage_orders = true, can_manage_production = true, can_view_reports = false,
      can_manage_settings = false, updated_by = (select auth.uid()), updated_at = now()
    where staff_user_id = target_user_id;
  end if;

  return to_jsonb(target);
end;
$$;

revoke all on function public.owner_set_staff_access(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.owner_set_staff_access(uuid,text,boolean) to authenticated;

comment on table public.staff_private_profiles is
  'Ficha pessoal de integrantes da equipe. Somente proprietarios ativos podem ler ou alterar.';
comment on table public.staff_private_emails is
  'Emails de contato da equipe. Um principal por pessoa e principal unico no sistema.';

commit;
