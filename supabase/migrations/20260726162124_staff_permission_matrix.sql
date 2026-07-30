begin;

alter type public.staff_role add value if not exists 'cashier';
alter type public.staff_role add value if not exists 'production';

alter table public.staff_store_assignments
  add column if not exists can_manage_customers boolean not null default false,
  add column if not exists can_manage_orders boolean not null default false,
  add column if not exists can_manage_production boolean not null default false,
  add column if not exists can_view_reports boolean not null default false,
  add column if not exists can_manage_settings boolean not null default false;

create or replace function private.staff_has_capability(
  target_store_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    left join public.staff_store_assignments a
      on a.staff_user_id = s.user_id
     and a.store_id = target_store_id
     and a.active
    where s.user_id = (select auth.uid())
      and s.active
      and (
        s.role::text in ('owner', 'manager')
        or (
          a.staff_user_id is not null
          and case requested_capability
            when 'sell' then a.can_sell
            when 'open_cash' then a.can_open_cash
            when 'close_cash' then a.can_close_cash
            when 'manage_stock' then a.can_manage_stock
            when 'view_finance' then a.can_view_finance
            when 'manage_customers' then a.can_manage_customers
            when 'manage_loyalty' then a.can_manage_customers
            when 'manage_orders' then a.can_manage_orders
            when 'manage_production' then a.can_manage_production
            when 'view_reports' then a.can_view_reports
            when 'manage_settings' then a.can_manage_settings
            else false
          end
        )
      )
  );
$$;

create or replace function private.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    left join public.staff_store_assignments a
      on a.staff_user_id = s.user_id
     and a.store_id = target_store_id
     and a.active
    where s.user_id = (select auth.uid())
      and s.active
      and (s.role::text in ('owner', 'manager') or a.staff_user_id is not null)
  );
$$;

create or replace function private.can_sell_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'sell'); $$;

create or replace function private.can_open_cash_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'open_cash'); $$;

create or replace function private.can_close_cash_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'close_cash'); $$;

create or replace function private.can_manage_stock_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'manage_stock'); $$;

create or replace function private.can_view_finance_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'view_finance'); $$;

create or replace function private.can_manage_customers_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'manage_customers'); $$;

create or replace function private.can_manage_orders_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'manage_orders'); $$;

create or replace function private.can_manage_production_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'manage_production'); $$;

create or replace function private.can_view_reports_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'view_reports'); $$;

create or replace function private.can_manage_settings_at_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.staff_has_capability(target_store_id, 'manage_settings'); $$;

create or replace function public.manager_set_staff_capability(
  target_user_id uuid,
  target_store_id uuid,
  capability text,
  allowed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.staff_store_assignments%rowtype;
begin
  if not private.is_manager() then
    raise exception 'Apenas gestores podem administrar permissoes';
  end if;
  if capability not in (
    'sell', 'open_cash', 'close_cash', 'manage_stock', 'view_finance',
    'manage_customers', 'manage_orders', 'manage_production',
    'view_reports', 'manage_settings'
  ) then
    raise exception 'Permissao invalida';
  end if;
  if not exists(select 1 from public.staff_members where user_id = target_user_id) then
    raise exception 'Membro da equipe nao encontrado';
  end if;
  if not exists(select 1 from public.stores where id = target_store_id) then
    raise exception 'Loja nao encontrada';
  end if;

  insert into public.staff_store_assignments(
    staff_user_id, store_id, active, created_by, updated_by
  ) values (
    target_user_id, target_store_id, true, (select auth.uid()), (select auth.uid())
  )
  on conflict (staff_user_id, store_id) do update
    set active = true,
        updated_by = (select auth.uid()),
        updated_at = now();

  update public.staff_store_assignments
  set can_sell = case when capability = 'sell' then allowed else can_sell end,
      can_open_cash = case when capability = 'open_cash' then allowed else can_open_cash end,
      can_close_cash = case when capability = 'close_cash' then allowed else can_close_cash end,
      can_manage_stock = case when capability = 'manage_stock' then allowed else can_manage_stock end,
      can_view_finance = case when capability = 'view_finance' then allowed else can_view_finance end,
      can_manage_customers = case when capability = 'manage_customers' then allowed else can_manage_customers end,
      can_manage_orders = case when capability = 'manage_orders' then allowed else can_manage_orders end,
      can_manage_production = case when capability = 'manage_production' then allowed else can_manage_production end,
      can_view_reports = case when capability = 'view_reports' then allowed else can_view_reports end,
      can_manage_settings = case when capability = 'manage_settings' then allowed else can_manage_settings end,
      updated_by = (select auth.uid()),
      updated_at = now()
  where staff_user_id = target_user_id and store_id = target_store_id
  returning * into target;

  return to_jsonb(target);
end;
$$;

create or replace function public.manager_update_staff_member(
  target_user_id uuid,
  next_role text,
  next_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare current_staff_role text; target public.staff_members%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas gestores podem administrar a equipe'; end if;
  if next_role not in ('owner', 'manager', 'attendant', 'cashier', 'production', 'viewer') then
    raise exception 'Funcao invalida';
  end if;
  select role::text into current_staff_role from public.staff_members where user_id = target_user_id;
  if current_staff_role is null then raise exception 'Membro da equipe nao encontrado'; end if;
  if not private.is_owner() and (current_staff_role in ('owner', 'manager') or next_role in ('owner', 'manager')) then
    raise exception 'Somente o proprietario pode alterar proprietarios e gerentes';
  end if;
  if target_user_id = (select auth.uid()) and not coalesce(next_active, true) then
    raise exception 'Voce nao pode desativar o proprio acesso';
  end if;
  update public.staff_members
  set role = next_role::public.staff_role,
      active = coalesce(next_active, true)
  where user_id = target_user_id
  returning * into target;
  return to_jsonb(target);
end;
$$;

revoke all on function public.manager_set_staff_capability(uuid,uuid,text,boolean) from public, anon;
grant execute on function public.manager_set_staff_capability(uuid,uuid,text,boolean) to authenticated;

commit;
