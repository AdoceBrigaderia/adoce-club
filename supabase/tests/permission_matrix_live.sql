begin;

do $$
declare
  owner_actor uuid;
  test_staff uuid;
  primary_store uuid;
  secondary_store uuid;
  audit_before integer;
  audit_after integer;
  failure_message text;
begin
  select min(user_id), max(user_id)
  into owner_actor, test_staff
  from public.staff_members
  where role::text = 'owner' and active;

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

  update public.staff_members
  set role = 'cashier'::public.staff_role, active = true
  where user_id = test_staff;

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
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
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

  perform set_config('request.jwt.claim.sub', test_staff::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not private.staff_has_capability(primary_store, 'sell') then
    raise exception 'Cashier atribuído não recebeu capacidade de venda na própria loja';
  end if;
  if private.staff_has_capability(primary_store, 'view_finance') then
    raise exception 'Cashier recebeu acesso financeiro sem permissão';
  end if;
  if private.can_access_store(secondary_store) then
    raise exception 'Cashier acessou loja sem atribuição';
  end if;
  if private.staff_has_capability(secondary_store, 'sell') then
    raise exception 'Cashier vendeu em loja sem atribuição';
  end if;

  perform set_config('request.jwt.claim.sub', owner_actor::text, true);
  select count(*) into audit_before
  from public.audit_events
  where action = 'staff.capability_changed';

  perform public.manager_set_staff_capability(
    test_staff,
    secondary_store,
    'manage_production',
    true
  );

  select count(*) into audit_after
  from public.audit_events
  where action = 'staff.capability_changed';
  if audit_after <= audit_before then
    raise exception 'Mudança de capacidade não gerou auditoria';
  end if;

  update public.staff_members
  set role = 'production'::public.staff_role
  where user_id = test_staff;
  perform set_config('request.jwt.claim.sub', test_staff::text, true);
  if not private.staff_has_capability(secondary_store, 'manage_production') then
    raise exception 'Produção atribuída não recebeu capacidade na loja correta';
  end if;
  if private.staff_has_capability(primary_store, 'manage_production') then
    raise exception 'Produção acessou capacidade não atribuída na outra loja';
  end if;

  update public.staff_members
  set role = 'manager'::public.staff_role
  where user_id = test_staff;
  perform set_config('request.jwt.claim.sub', test_staff::text, true);
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
end;
$$;

rollback;
