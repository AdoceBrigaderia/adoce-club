begin;

-- A migration anterior introduz o escopo por loja sem tornar a coluna NOT NULL,
-- pois o wrapper público precisa concluir a criação e o vínculo na mesma transação.
-- Esta unidade garante que nenhuma encomenda possa permanecer sem loja ao commit.
do $$
declare
  active_store_count integer;
  only_active_store uuid;
  unscoped_count integer;
begin
  select count(*)
  into unscoped_count
  from public.service_requests request
  where request.store_id is null;

  if unscoped_count > 0 then
    select count(*)
    into active_store_count
    from public.stores store
    where store.active;

    if active_store_count <> 1 then
      raise exception
        'Existem % encomendas sem loja e % lojas ativas; faça o mapeamento explícito antes de continuar',
        unscoped_count,
        active_store_count;
    end if;

    select store.id
    into only_active_store
    from public.stores store
    where store.active
    order by store.created_at, store.id
    limit 1;

    update public.service_requests
    set store_id = only_active_store
    where store_id is null;
  end if;
end;
$$;

create or replace function private.assert_service_request_store_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- O trigger é diferido: o wrapper pode inserir e vincular a loja na mesma
  -- transação, mas uma linha ainda sem loja no commit bloqueia toda a operação.
  if exists (
    select 1
    from public.service_requests request
    where request.id = new.id
      and request.store_id is null
  ) then
    raise exception 'A encomenda não pode ser confirmada sem uma loja responsável';
  end if;

  return null;
end;
$$;

revoke all on function private.assert_service_request_store_scope()
  from public, anon, authenticated, service_role;

drop trigger if exists service_requests_store_scope_required
  on public.service_requests;
create constraint trigger service_requests_store_scope_required
after insert or update of store_id on public.service_requests
deferrable initially deferred
for each row execute function private.assert_service_request_store_scope();

-- As implementações internas são chamadas apenas pelos wrappers SECURITY DEFINER.
-- Nem mesmo o service_role deve conseguir contornar o wrapper e gravar sem loja.
revoke all on function public.submit_service_request_bff_unscoped_internal(
  uuid,uuid,text,text,text,integer,timestamptz,timestamptz,text,jsonb,text,uuid
) from public, anon, authenticated, service_role;

revoke all on function public.staff_get_service_request_workspace_unscoped_internal(
  text,text,integer
) from public, anon, authenticated, service_role;

revoke all on function public.staff_get_customer_service_request_history_unscoped_internal(
  uuid,integer
) from public, anon, authenticated, service_role;

-- Pós-gate fail-closed: dados históricos precisam estar resolvidos, o trigger
-- precisa ser realmente diferido e os RPCs internos não podem ser executáveis.
do $$
declare
  exposed_internal_functions text[];
begin
  if exists (
    select 1
    from public.service_requests request
    where request.store_id is null
  ) then
    raise exception 'Service requests still contain rows without store scope';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_info
    join pg_class table_info on table_info.oid = trigger_info.tgrelid
    join pg_namespace namespace_info on namespace_info.oid = table_info.relnamespace
    where namespace_info.nspname = 'public'
      and table_info.relname = 'service_requests'
      and trigger_info.tgname = 'service_requests_store_scope_required'
      and not trigger_info.tgisinternal
      and trigger_info.tgdeferrable
      and trigger_info.tginitdeferred
  ) then
    raise exception 'Deferred service-request store-scope trigger is missing';
  end if;

  select array_agg(signature order by signature)
  into exposed_internal_functions
  from unnest(array[
    'public.submit_service_request_bff_unscoped_internal(uuid,uuid,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,jsonb,text,uuid)',
    'public.staff_get_service_request_workspace_unscoped_internal(text,text,integer)',
    'public.staff_get_customer_service_request_history_unscoped_internal(uuid,integer)'
  ]) signature
  where has_function_privilege('service_role', signature, 'EXECUTE');

  if coalesce(cardinality(exposed_internal_functions), 0) > 0 then
    raise exception 'Internal service-request functions remain executable by service_role: %',
      exposed_internal_functions;
  end if;
end;
$$;

commit;
