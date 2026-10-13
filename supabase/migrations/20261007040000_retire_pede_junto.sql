begin;

-- Preserva tabelas e registros históricos, mas encerra as ações do fluxo.
-- Todas as versões públicas são abrangidas para impedir clientes antigos.
do $$
declare
  target record;
begin
  for target in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_pede_junto_group', 'create_pede_junto_group_v2',
        'join_pede_junto_group', 'join_pede_junto_group_v2',
        'join_pede_junto_group_v3', 'set_pede_junto_selection',
        'submit_pede_junto_group', 'staff_update_pede_junto_group',
        'staff_update_pede_junto_participant'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', target.signature);
  end loop;
end $$;

commit;
