begin;

create or replace function private.staff_role_allows_capability(
  target_role text,
  requested_capability text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case lower(coalesce(target_role, ''))
    when 'owner' then requested_capability = any (array[
      'sell', 'open_cash', 'close_cash', 'manage_stock', 'view_finance',
      'manage_customers', 'manage_loyalty', 'manage_orders',
      'manage_production', 'view_reports', 'manage_settings'
    ]::text[])
    when 'manager' then requested_capability = any (array[
      'sell', 'open_cash', 'close_cash', 'manage_stock', 'view_finance',
      'manage_customers', 'manage_loyalty', 'manage_orders',
      'manage_production', 'view_reports', 'manage_settings'
    ]::text[])
    when 'attendant' then requested_capability = any (array[
      'sell', 'manage_customers', 'manage_loyalty', 'manage_orders'
    ]::text[])
    when 'cashier' then requested_capability = any (array[
      'sell', 'open_cash', 'close_cash'
    ]::text[])
    when 'production' then requested_capability = any (array[
      'manage_stock', 'manage_production'
    ]::text[])
    when 'viewer' then requested_capability = 'view_reports'
    else false
  end;
$$;

comment on function private.staff_role_allows_capability(text,text) is
  'Teto fail-closed de capacidades por papel. A atribuição por loja nunca amplia o papel.';

revoke all on function private.staff_role_allows_capability(text,text)
  from public, anon, authenticated;

do $$
declare
  normalized_count integer;
begin
  update public.staff_store_assignments assignment
  set can_sell = assignment.can_sell
      and private.staff_role_allows_capability(member.role::text, 'sell'),
      can_open_cash = assignment.can_open_cash
      and private.staff_role_allows_capability(member.role::text, 'open_cash'),
      can_close_cash = assignment.can_close_cash
      and private.staff_role_allows_capability(member.role::text, 'close_cash'),
      can_manage_stock = assignment.can_manage_stock
      and private.staff_role_allows_capability(member.role::text, 'manage_stock'),
      can_view_finance = assignment.can_view_finance
      and private.staff_role_allows_capability(member.role::text, 'view_finance'),
      can_manage_customers = assignment.can_manage_customers
      and private.staff_role_allows_capability(member.role::text, 'manage_customers'),
      can_manage_orders = assignment.can_manage_orders
      and private.staff_role_allows_capability(member.role::text, 'manage_orders'),
      can_manage_production = assignment.can_manage_production
      and private.staff_role_allows_capability(member.role::text, 'manage_production'),
      can_view_reports = assignment.can_view_reports
      and private.staff_role_allows_capability(member.role::text, 'view_reports'),
      can_manage_settings = assignment.can_manage_settings
      and private.staff_role_allows_capability(member.role::text, 'manage_settings'),
      updated_at = now()
  from public.staff_members member
  where member.user_id = assignment.staff_user_id
    and (
      (assignment.can_sell and not private.staff_role_allows_capability(member.role::text, 'sell'))
      or (assignment.can_open_cash and not private.staff_role_allows_capability(member.role::text, 'open_cash'))
      or (assignment.can_close_cash and not private.staff_role_allows_capability(member.role::text, 'close_cash'))
      or (assignment.can_manage_stock and not private.staff_role_allows_capability(member.role::text, 'manage_stock'))
      or (assignment.can_view_finance and not private.staff_role_allows_capability(member.role::text, 'view_finance'))
      or (assignment.can_manage_customers and not private.staff_role_allows_capability(member.role::text, 'manage_customers'))
      or (assignment.can_manage_orders and not private.staff_role_allows_capability(member.role::text, 'manage_orders'))
      or (assignment.can_manage_production and not private.staff_role_allows_capability(member.role::text, 'manage_production'))
      or (assignment.can_view_reports and not private.staff_role_allows_capability(member.role::text, 'view_reports'))
      or (assignment.can_manage_settings and not private.staff_role_allows_capability(member.role::text, 'manage_settings'))
    );

  get diagnostics normalized_count = row_count;
  raise notice 'Matriz de permissões normalizada: % atribuições ajustadas', normalized_count;
end;
$$;

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
    from public.staff_members member
    left join public.staff_store_assignments assignment
      on assignment.staff_user_id = member.user_id
     and assignment.store_id = target_store_id
     and assignment.active
    where member.user_id = (select auth.uid())
      and member.active
      and private.staff_role_allows_capability(member.role::text, requested_capability)
      and (
        member.role::text in ('owner', 'manager')
        or (
          assignment.staff_user_id is not null
          and case requested_capability
            when 'sell' then assignment.can_sell
            when 'open_cash' then assignment.can_open_cash
            when 'close_cash' then assignment.can_close_cash
            when 'manage_stock' then assignment.can_manage_stock
            when 'view_finance' then assignment.can_view_finance
            when 'manage_customers' then assignment.can_manage_customers
            when 'manage_loyalty' then assignment.can_manage_customers
            when 'manage_orders' then assignment.can_manage_orders
            when 'manage_production' then assignment.can_manage_production
            when 'view_reports' then assignment.can_view_reports
            when 'manage_settings' then assignment.can_manage_settings
            else false
          end
        )
      )
  );
$$;

create or replace function public.manager_set_staff_store_assignment(
  target_user_id uuid,
  target_store_id uuid,
  next_active boolean,
  next_can_sell boolean,
  next_can_open_cash boolean,
  next_can_close_cash boolean,
  next_can_manage_stock boolean,
  next_can_view_finance boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.staff_store_assignments%rowtype;
  target_role text;
begin
  if not private.is_manager() then
    raise exception 'Apenas gestores podem administrar permissões';
  end if;

  select member.role::text
  into target_role
  from public.staff_members member
  where member.user_id = target_user_id;

  if target_role is null then
    raise exception 'Membro da equipe não encontrado';
  end if;
  if target_role in ('owner', 'manager') and not private.is_owner() then
    raise exception 'Somente o proprietário pode alterar permissões de proprietários e gestores';
  end if;
  if not exists(select 1 from public.stores store where store.id = target_store_id) then
    raise exception 'Loja não encontrada';
  end if;

  if coalesce(next_can_sell, false)
     and not private.staff_role_allows_capability(target_role, 'sell') then
    raise exception 'A função selecionada não permite vender';
  end if;
  if coalesce(next_can_open_cash, false)
     and not private.staff_role_allows_capability(target_role, 'open_cash') then
    raise exception 'A função selecionada não permite abrir caixa';
  end if;
  if coalesce(next_can_close_cash, false)
     and not private.staff_role_allows_capability(target_role, 'close_cash') then
    raise exception 'A função selecionada não permite fechar caixa';
  end if;
  if coalesce(next_can_manage_stock, false)
     and not private.staff_role_allows_capability(target_role, 'manage_stock') then
    raise exception 'A função selecionada não permite gerenciar estoque';
  end if;
  if coalesce(next_can_view_finance, false)
     and not private.staff_role_allows_capability(target_role, 'view_finance') then
    raise exception 'A função selecionada não permite visualizar o financeiro';
  end if;

  insert into public.staff_store_assignments(
    staff_user_id,
    store_id,
    active,
    can_sell,
    can_open_cash,
    can_close_cash,
    can_manage_stock,
    can_view_finance,
    created_by,
    updated_by
  ) values (
    target_user_id,
    target_store_id,
    coalesce(next_active, true),
    coalesce(next_can_sell, false),
    coalesce(next_can_open_cash, false),
    coalesce(next_can_close_cash, false),
    coalesce(next_can_manage_stock, false),
    coalesce(next_can_view_finance, false),
    (select auth.uid()),
    (select auth.uid())
  )
  on conflict (staff_user_id, store_id) do update
  set active = excluded.active,
      can_sell = excluded.can_sell,
      can_open_cash = excluded.can_open_cash,
      can_close_cash = excluded.can_close_cash,
      can_manage_stock = excluded.can_manage_stock,
      can_view_finance = excluded.can_view_finance,
      updated_by = (select auth.uid()),
      updated_at = now()
  returning * into target;

  insert into public.audit_events(
    actor_user_id, action, entity_type, entity_id, payload
  ) values (
    (select auth.uid()),
    'staff.store_assignment_changed',
    'staff_store_assignment',
    target_user_id::text || ':' || target_store_id::text,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'target_role', target_role,
      'store_id', target_store_id,
      'active', target.active,
      'can_sell', target.can_sell,
      'can_open_cash', target.can_open_cash,
      'can_close_cash', target.can_close_cash,
      'can_manage_stock', target.can_manage_stock,
      'can_view_finance', target.can_view_finance,
      'role_ceiling_enforced', true
    )
  );

  return to_jsonb(target);
end;
$$;

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
declare
  target public.staff_store_assignments%rowtype;
  target_role text;
begin
  if not private.is_manager() then
    raise exception 'Apenas gestores podem administrar permissões';
  end if;
  if allowed is null then
    raise exception 'Informe se a permissão será ativada ou removida';
  end if;
  if capability not in (
    'sell', 'open_cash', 'close_cash', 'manage_stock', 'view_finance',
    'manage_customers', 'manage_orders', 'manage_production',
    'view_reports', 'manage_settings'
  ) then
    raise exception 'Permissão inválida';
  end if;

  select member.role::text
  into target_role
  from public.staff_members member
  where member.user_id = target_user_id;

  if target_role is null then
    raise exception 'Membro da equipe não encontrado';
  end if;
  if target_role in ('owner', 'manager') and not private.is_owner() then
    raise exception 'Somente o proprietário pode alterar permissões de proprietários e gestores';
  end if;
  if allowed and not private.staff_role_allows_capability(target_role, capability) then
    raise exception 'A função selecionada não permite esta ação';
  end if;
  if not exists(select 1 from public.stores where id = target_store_id) then
    raise exception 'Loja não encontrada';
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

  insert into public.audit_events(
    actor_user_id, action, entity_type, entity_id, payload
  ) values (
    (select auth.uid()),
    'staff.capability_changed',
    'staff_store_assignment',
    target_user_id::text || ':' || target_store_id::text,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'target_role', target_role,
      'store_id', target_store_id,
      'capability', capability,
      'allowed', allowed,
      'role_ceiling_enforced', true
    )
  );

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
declare
  actor_user_id uuid := (select auth.uid());
  current_staff_role text;
  current_active boolean;
  active_owner_count integer;
  normalized_assignment_count integer := 0;
  target public.staff_members%rowtype;
begin
  if not private.is_manager() then
    raise exception 'Apenas gestores podem administrar a equipe';
  end if;
  if next_role not in ('owner', 'manager', 'attendant', 'cashier', 'production', 'viewer') then
    raise exception 'Função inválida';
  end if;
  if next_active is null then
    raise exception 'Informe se o acesso ficará ativo';
  end if;

  select member.role::text, member.active
  into current_staff_role, current_active
  from public.staff_members member
  where member.user_id = target_user_id
  for update;

  if current_staff_role is null then
    raise exception 'Membro da equipe não encontrado';
  end if;
  if not private.is_owner()
     and (current_staff_role in ('owner', 'manager') or next_role in ('owner', 'manager')) then
    raise exception 'Somente o proprietário pode alterar proprietários e gestores';
  end if;
  if target_user_id = actor_user_id
     and (next_role is distinct from current_staff_role or not next_active) then
    raise exception 'Seu próprio papel e acesso devem ser alterados por outro proprietário';
  end if;

  if current_staff_role = 'owner'
     and (next_role <> 'owner' or not next_active) then
    perform 1
    from public.staff_members member
    where member.role::text = 'owner'
      and member.active
    order by member.user_id
    for update;

    select count(*)::integer
    into active_owner_count
    from public.staff_members member
    where member.role::text = 'owner'
      and member.active;

    if active_owner_count <= 1 then
      raise exception 'A operação precisa manter pelo menos um proprietário ativo';
    end if;
  end if;

  update public.staff_members
  set role = next_role::public.staff_role,
      active = next_active
  where user_id = target_user_id
  returning * into target;

  update public.staff_store_assignments assignment
  set can_sell = assignment.can_sell
      and private.staff_role_allows_capability(next_role, 'sell'),
      can_open_cash = assignment.can_open_cash
      and private.staff_role_allows_capability(next_role, 'open_cash'),
      can_close_cash = assignment.can_close_cash
      and private.staff_role_allows_capability(next_role, 'close_cash'),
      can_manage_stock = assignment.can_manage_stock
      and private.staff_role_allows_capability(next_role, 'manage_stock'),
      can_view_finance = assignment.can_view_finance
      and private.staff_role_allows_capability(next_role, 'view_finance'),
      can_manage_customers = assignment.can_manage_customers
      and private.staff_role_allows_capability(next_role, 'manage_customers'),
      can_manage_orders = assignment.can_manage_orders
      and private.staff_role_allows_capability(next_role, 'manage_orders'),
      can_manage_production = assignment.can_manage_production
      and private.staff_role_allows_capability(next_role, 'manage_production'),
      can_view_reports = assignment.can_view_reports
      and private.staff_role_allows_capability(next_role, 'view_reports'),
      can_manage_settings = assignment.can_manage_settings
      and private.staff_role_allows_capability(next_role, 'manage_settings'),
      updated_by = actor_user_id,
      updated_at = now()
  where assignment.staff_user_id = target_user_id
    and (
      (assignment.can_sell and not private.staff_role_allows_capability(next_role, 'sell'))
      or (assignment.can_open_cash and not private.staff_role_allows_capability(next_role, 'open_cash'))
      or (assignment.can_close_cash and not private.staff_role_allows_capability(next_role, 'close_cash'))
      or (assignment.can_manage_stock and not private.staff_role_allows_capability(next_role, 'manage_stock'))
      or (assignment.can_view_finance and not private.staff_role_allows_capability(next_role, 'view_finance'))
      or (assignment.can_manage_customers and not private.staff_role_allows_capability(next_role, 'manage_customers'))
      or (assignment.can_manage_orders and not private.staff_role_allows_capability(next_role, 'manage_orders'))
      or (assignment.can_manage_production and not private.staff_role_allows_capability(next_role, 'manage_production'))
      or (assignment.can_view_reports and not private.staff_role_allows_capability(next_role, 'view_reports'))
      or (assignment.can_manage_settings and not private.staff_role_allows_capability(next_role, 'manage_settings'))
    );

  get diagnostics normalized_assignment_count = row_count;

  insert into public.audit_events(
    actor_user_id, action, entity_type, entity_id, payload
  ) values (
    actor_user_id,
    'staff.member_changed',
    'staff_member',
    target_user_id::text,
    jsonb_build_object(
      'previous_role', current_staff_role,
      'next_role', next_role,
      'previous_active', current_active,
      'next_active', next_active,
      'normalized_assignment_count', normalized_assignment_count,
      'owner_change_serialized', current_staff_role = 'owner'
        and (next_role <> 'owner' or not next_active)
    )
  );

  return to_jsonb(target);
end;
$$;

revoke all on function public.manager_set_staff_store_assignment(
  uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean
) from public, anon;
grant execute on function public.manager_set_staff_store_assignment(
  uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean
) to authenticated;

revoke all on function public.manager_set_staff_capability(uuid,uuid,text,boolean)
  from public, anon;
grant execute on function public.manager_set_staff_capability(uuid,uuid,text,boolean)
  to authenticated;

revoke all on function public.manager_update_staff_member(uuid,text,boolean)
  from public, anon;
grant execute on function public.manager_update_staff_member(uuid,text,boolean)
  to authenticated;

commit;
