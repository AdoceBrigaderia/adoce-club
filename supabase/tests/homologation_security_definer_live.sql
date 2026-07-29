\set ON_ERROR_STOP on

begin;

select pg_advisory_xact_lock(hashtextextended('adoce:homologation:security-definer-audit', 0));

do $$
declare
  target regprocedure;
  definition text;
  function_name text;
  public_catalogs constant text[] := array[
    'public.get_configurable_product_catalog(text)',
    'public.public_get_cake_builder_catalog(uuid)'
  ];
  manager_functions constant text[] := array[
    'public.manager_get_configurable_product_workspace()',
    'public.manager_save_configurable_product(jsonb,jsonb)'
  ];
begin
  foreach function_name in array public_catalogs loop
    target := to_regprocedure(function_name);
    if target is null then
      raise exception 'Função pública ausente: %', function_name;
    end if;
    if not exists (
      select 1
      from pg_proc procedure
      where procedure.oid = target
        and procedure.prosecdef
        and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']
    ) then
      raise exception 'Função pública sem SECURITY DEFINER/search_path seguro: %', function_name;
    end if;
    if not has_function_privilege('anon', target, 'EXECUTE') then
      raise exception 'Catálogo público sem grant anon: %', function_name;
    end if;

    definition := lower(pg_get_functiondef(target));
    if definition ~ 'unit_cost''\s*,\s*option\.unit_cost'
      or definition like '%to_jsonb(product)%'
    then
      raise exception 'Catálogo público expõe dados internos: %', function_name;
    end if;
    if definition not like '%and product.active%'
      or definition not like '%and product.published%'
    then
      raise exception 'Catálogo público sem filtro ativo/publicado: %', function_name;
    end if;
  end loop;

  foreach function_name in array manager_functions loop
    target := to_regprocedure(function_name);
    if target is null then
      raise exception 'Função gerencial ausente: %', function_name;
    end if;
    if has_function_privilege('anon', target, 'EXECUTE') then
      raise exception 'Função gerencial executável por anon: %', function_name;
    end if;
    if not has_function_privilege('authenticated', target, 'EXECUTE') then
      raise exception 'Função gerencial sem grant autenticado: %', function_name;
    end if;

    definition := lower(pg_get_functiondef(target));
    if definition not like '%private.is_manager()%' then
      raise exception 'Função gerencial sem guarda manager: %', function_name;
    end if;
    if not exists (
      select 1
      from pg_proc procedure
      where procedure.oid = target
        and procedure.prosecdef
        and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']
    ) then
      raise exception 'Função gerencial sem search_path seguro: %', function_name;
    end if;
  end loop;

  target := to_regprocedure('public.staff_get_service_request_workspace(text,text,integer)');
  if target is null then
    raise exception 'Workspace de encomendas ausente';
  end if;
  if has_function_privilege('anon', target, 'EXECUTE') then
    raise exception 'Workspace de encomendas executável por anon';
  end if;
  if not has_function_privilege('authenticated', target, 'EXECUTE') then
    raise exception 'Workspace de encomendas sem grant autenticado';
  end if;

  definition := lower(pg_get_functiondef(target));
  if definition not like '%auth.uid()%'
    or definition not like '%staff_store_assignments%'
  then
    raise exception 'Workspace de encomendas sem guarda de usuário/loja';
  end if;
  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid = target
      and procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']
  ) then
    raise exception 'Workspace de encomendas sem search_path seguro';
  end if;
end;
$$;

select
  namespace.nspname as schema_name,
  procedure.proname,
  pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
  procedure.prosecdef as security_definer,
  has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'get_configurable_product_catalog',
    'public_get_cake_builder_catalog',
    'manager_get_configurable_product_workspace',
    'manager_save_configurable_product',
    'staff_get_service_request_workspace'
  )
order by procedure.proname, identity_arguments;

rollback;
