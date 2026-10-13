-- Accept the Portuguese label sent by previously opened versions of the form.
-- Persist the canonical code; preserve manager checks, grants and all other validation.
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid) into function_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'manager_save_costing_technical_sheet';
  if function_definition is null then raise exception 'Costing save function not found'; end if;
  if position('component_unit := entry->>''unit'';' in function_definition) = 0 then
    raise exception 'Unexpected costing save function definition';
  end if;
  function_definition := replace(function_definition,
    'component_unit := entry->>''unit'';',
    'component_unit := case when entry->>''unit'' = ''unidade'' then ''unit'' else entry->>''unit'' end;');
  execute function_definition;
end;
$migration$;
