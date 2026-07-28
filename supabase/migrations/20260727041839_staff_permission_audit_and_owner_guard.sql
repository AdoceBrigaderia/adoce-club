begin;

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
      'allowed', allowed
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
      'next_active', next_active
    )
  );

  return to_jsonb(target);
end;
$$;

revoke all on function public.manager_set_staff_capability(uuid,uuid,text,boolean)
  from public, anon;
grant execute on function public.manager_set_staff_capability(uuid,uuid,text,boolean)
  to authenticated;

revoke all on function public.manager_update_staff_member(uuid,text,boolean)
  from public, anon;
grant execute on function public.manager_update_staff_member(uuid,text,boolean)
  to authenticated;

commit;
