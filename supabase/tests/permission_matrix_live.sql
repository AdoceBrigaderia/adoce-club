begin;

do $$
declare
  owner_actor uuid;
  test_staff uuid;
  owner_ids uuid[];
  primary_store uuid;
  secondary_store uuid;
  audit_before integer;
  audit_after integer;
  failure_message text;
  function_definition text;
  normalized_assignment public.staff_store_assignments%rowtype;
begin
  select array_agg(user_id order by user_id::text)
  into owner_ids
  from public.staff_members
  where role::text = 'owner' and active;

  owner_actor := owner_ids[1];
  test_staff := owner_ids[2];
  if owner_actor is null or test_staff is null or owner_actor = test_staff then
    raise exception 'O teste vivo exige dois proprietários ativos em homologação';
  end if;

  select id into primary_store
  from public.stores
  where active
  order by created_at
  limit 1;

  if primary_store is null then
    raise exception 'O teste vivo exige uma loja ativa em homologação';
  end if;

  insert into public.stores(slug, name, public_label, active)
  values (
    'permission-test-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    'Loja temporária do teste de permissões',
    'Teste temporário',
    true
  ) returning id into secondary_store;

  insert into public.staff_store_assignments(
    staff_user_id,
    store_id,
    active,
    can_sell,
    can_open_cash,
    can_close_cash,
    can_manage_stock,
    can_view_finance,
    can_manage_customers,
    can_manage_orders,
    can_manage_production,
    can_view_reports,
    can_manage_settings,
    created_by,
    updated_by
  ) values (
    test_staff,
    primary_store,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    owner_actor,
    owner_actor
  )
  on conflict (staff_user_id, store_id) do update
  set active = excluded.active,
      can_sell = excluded.can_sell,
      can_open_cash = excluded.can_open_cash,
      can_close_cash = excluded.can_close_cash,
      can_manage_stock = excluded.can_manage_stock,
      can_view_finance = excluded.can_view_finance,
      can_manage_customers = excluded.can_manage_customers,
      can_manage_orders = excluded.can_manage_orders,
      can_manage_production = excluded.can_manage_production,
      can_view_reports = excluded.can_view_reports,
      can_manage_settings = excluded.can_manage_settings;

  if not private.staff_role_allows_capability('owner', 'manage_settings')
     or not private.staff_role_allows_capability('manager', 'view_finance')
     or not private.staff_role_allows_capability('attendant', 'manage_customers')
     or not private.staff_role_allows_capability('cashier', 'open_cash')
     or not private.staff_role_allows_capability('production', 'manage_production')
     or not private.staff_role_allows_capability('viewer', 'view_reports') then
    raise exception 'A matriz deixou de liberar uma capacidade esperada';
  end if;

  if private.staff_role_allows_capability('viewer', 'sell')
     or private.staff_role_allows_capability('cashier', 'view_finance')
     or private.staff_role_allows_capability('production', 'open_cash')
     or private.staff_role_allows_capability('attendant', 'manage_settings')
     or private.staff_role_allows_capability('papel-invalido', 'sell')
     or private.staff_role_allows_capability('viewer', 'capacidade-invalida') then
    raise exception 'A matriz deixou de negar uma combinação de papel e capacidade';
  end if;

  update public.staff_members
  set role = 'attendant'::public.staff_role, active = true
  where user_id = test_staff;
  perform set_config('request.jwt.claim.sub', test_staff::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not private.staff_has_capability(primary_store, 'sell')
     or not private.staff_has_capability(primary_store, 'manage_customers')
     or not private.staff_has_capability(primary_store, 'manage_orders') then
    raise exception 'Atendimento não recebeu as capacidades operacionais permitidas';
  end if;
  if private.staff_has_capability(primary_store, 'open_cash')
     or private.staff_has_capability(primary_store, 'view_finance')
     or private.staff_has_capability(primary_store, 'manage_production')
     or private.staff_has_capability(primary_store, 'view_reports') then
    raise exception 'Atendimento ultrapassou o teto do próprio papel';
  end if;
  if private.can_access_store(secondary_store) then
    raise exception 'Atendimento acessou loja sem atribuição';
  end if;

  update public.staff_members
  set role = 'cashier'::public.staff_role
  where user_id = test_staff;

  if not private.staff_has_capability(primary_store, 'sell')
     or not private.staff_has_capability(primary_store, 'open_cash')
     or not private.staff_has_capability(primary_store, 'close_cash') then
    raise exception 'Caixa não recebeu venda, abertura e fechamento na loja atribuída';
  end if;
  if private.staff_has_capability(primary_store, 'manage_stock')
     or private.staff_has_capability(primary_store, 'view_finance')
     or private.staff_has_capability(primary_store, 'manage_customers') then
    raise exception 'Caixa ultrapassou o teto do próprio papel';
  end if;
  if private.staff_has_capability(secondary_store, 'sell') then
    raise exception 'Caixa vendeu em loja sem atribuição';
  end if;

  update public.staff_members
  set role = 'production'::public.staff_role
  where user_id = test_staff;

  if not private.staff_has_capability(primary_store, 'manage_stock')
     or not private.staff_has_capability(primary_store, 'manage_production') then
    raise exception 'Produção não recebeu estoque e produção na loja atribuída';
  end if;
  if private.staff_has_capability(primary_store, 'sell')
     or private.staff_has_capability(primary_store, 'open_cash')
     or private.staff_has_capability(primary_store, 'view_reports') then
    raise exception 'Produção ultrapassou o teto do próprio papel';
  end if;

  update public.staff_members
  set role = 'viewer'::public.staff_role
  where user_id = test_staff;

  if not private.staff_has_capability(primary_store, 'view_reports') then
    raise exception 'Consulta não recebeu leitura de relatórios na loja atribuída';
  end if;
  if private.staff_has_capability(primary_store, 'sell')
     or private.staff_has_capability(primary_store, 'open_cash')
     or private.staff_has_capability(primary_store, 'manage_stock')
     or private.staff_has_capability(primary_store, 'view_finance')
     or private.staff_has_capability(primary_store, 'manage_customers')
     or private.staff_has_capability(primary_store, 'manage_settings') then
    raise exception 'Consulta recebeu capacidade de escrita ou financeira';
  end if;

  perform set_config('request.jwt.claim.sub', owner_actor::text, true);
  begin
    perform public.manager_set_staff_capability(
      test_staff,
      primary_store,
      'sell',
      true
    );
    raise exception 'Foi possível ampliar o papel viewer por uma atribuição de loja';
  exception
    when others then
      failure_message := sqlerrm;
      if failure_message = 'Foi possível ampliar o papel viewer por uma atribuição de loja'
         or position('não permite esta ação' in failure_message) = 0 then
        raise;
      end if;
  end;

  select count(*) into audit_before
  from public.audit_events
  where action = 'staff.capability_changed';

  perform public.manager_set_staff_capability(
    test_staff,
    secondary_store,
    'view_reports',
    true
  );

  select count(*) into audit_after
  from public.audit_events
  where action = 'staff.capability_changed';
  if audit_after <= audit_before then
    raise exception 'Mudança de capacidade válida não gerou auditoria';
  end if;

  update public.staff_members
  set role = 'cashier'::public.staff_role
  where user_id = test_staff;
  update public.staff_store_assignments
  set can_sell = true,
      can_open_cash = true,
      can_close_cash = true,
      can_manage_stock = true,
      can_view_finance = true,
      can_manage_customers = true,
      can_manage_orders = true,
      can_manage_production = true,
      can_view_reports = true,
      can_manage_settings = true
  where staff_user_id = test_staff
    and store_id = primary_store;

  perform public.manager_update_staff_member(test_staff, 'viewer', true);

  select * into normalized_assignment
  from public.staff_store_assignments
  where staff_user_id = test_staff
    and store_id = primary_store;

  if normalized_assignment.can_sell
     or normalized_assignment.can_open_cash
     or normalized_assignment.can_close_cash
     or normalized_assignment.can_manage_stock
     or normalized_assignment.can_view_finance
     or normalized_assignment.can_manage_customers
     or normalized_assignment.can_manage_orders
     or normalized_assignment.can_manage_production
     or normalized_assignment.can_manage_settings
     or not normalized_assignment.can_view_reports then
    raise exception 'Mudança de papel não normalizou as atribuições persistidas';
  end if;

  update public.staff_members
  set role = 'manager'::public.staff_role
  where user_id = test_staff;
  perform set_config('request.jwt.claim.sub', test_staff::text, true);

  if not private.staff_has_capability(secondary_store, 'manage_settings') then
    raise exception 'Gerente não recebeu a capacidade administrativa esperada';
  end if;

  begin
    perform public.manager_update_staff_member(owner_actor, 'viewer', true);
    raise exception 'Gerente conseguiu alterar proprietário';
  exception
    when others then
      failure_message := sqlerrm;
      if failure_message = 'Gerente conseguiu alterar proprietário'
         or position('Somente o proprietário' in failure_message) = 0 then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', owner_actor::text, true);
  begin
    perform public.manager_update_staff_member(owner_actor, 'manager', true);
    raise exception 'Proprietário conseguiu alterar o próprio papel';
  exception
    when others then
      failure_message := sqlerrm;
      if failure_message = 'Proprietário conseguiu alterar o próprio papel'
         or position('próprio papel' in failure_message) = 0 then
        raise;
      end if;
  end;

  select pg_get_functiondef(
    'public.manager_update_staff_member(uuid,text,boolean)'::regprocedure
  ) into function_definition;

  if position('order by member.user_id' in lower(function_definition)) = 0
     or position('for update' in lower(function_definition)) = 0 then
    raise exception 'A proteção concorrente do último proprietário não está ativa';
  end if;
end;
$$;

rollback;
