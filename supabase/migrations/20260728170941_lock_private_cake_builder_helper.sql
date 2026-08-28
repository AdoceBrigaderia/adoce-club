begin;

revoke all on function private.canonicalize_cake_builder_selection(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function private.canonicalize_cake_builder_selection(uuid,jsonb)
  to service_role;

revoke all on function private.cake_builder_distinct_uuid_array(uuid[])
  from public, anon, authenticated;
grant execute on function private.cake_builder_distinct_uuid_array(uuid[])
  to service_role;

comment on function private.canonicalize_cake_builder_selection(uuid,jsonb) is
  'Helper privado de cálculo e custo, invocável somente pelo backend autorizado.';

commit;
