begin;

create or replace function private.guard_service_request_production_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.status::text is distinct from old.status::text
     and new.status::text in ('in_production', 'ready')
     and not private.staff_has_capability(new.store_id, 'manage_production') then
    raise exception 'Ação de produção não autorizada para esta loja';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_service_request_production_transition()
  from public, anon, authenticated;

drop trigger if exists service_requests_production_capability_guard
  on public.service_requests;
create trigger service_requests_production_capability_guard
before update of status on public.service_requests
for each row execute function private.guard_service_request_production_transition();

create or replace function public.staff_transition_service_request_production(
  target_request_id uuid,
  operation_key uuid,
  requested_action text,
  requested_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.service_requests%rowtype;
  existing_result jsonb;
  normalized_action text := lower(btrim(coalesce(requested_action, '')));
  normalized_note text := btrim(coalesce(requested_note, ''));
  previous_status text;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'Sessão operacional obrigatória';
  end if;
  if target_request_id is null or operation_key is null then
    raise exception 'Encomenda e chave idempotente são obrigatórias';
  end if;
  if normalized_action not in ('start_production', 'mark_ready') then
    raise exception 'Ação de produção inválida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('service-request-operation:' || operation_key::text, 0)
  );

  select audit.payload->'result'
  into existing_result
  from public.audit_logs audit
  where audit.action = 'service_request_transition'
    and audit.entity_type = 'service_request'
    and audit.payload->>'operation_key' = operation_key::text
  order by audit.id desc
  limit 1;

  if existing_result is not null then
    return existing_result || jsonb_build_object('idempotent', true);
  end if;

  select request.*
  into request_row
  from public.service_requests request
  where request.id = target_request_id
  for update;

  if request_row.id is null then
    raise exception 'Encomenda não encontrada';
  end if;
  if request_row.store_id is null
     or not private.staff_has_capability(request_row.store_id, 'manage_production') then
    raise exception 'Você não possui permissão de produção nesta loja';
  end if;

  previous_status := request_row.status::text;
  if normalized_action = 'start_production' then
    if previous_status <> 'confirmed' then
      raise exception 'Somente encomendas confirmadas podem entrar em produção';
    end if;
    update public.service_requests
    set status = 'in_production',
        production_started_at = coalesce(production_started_at, now()),
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;
  else
    if previous_status <> 'in_production' then
      raise exception 'Somente encomendas em produção podem ficar prontas';
    end if;
    update public.service_requests
    set status = 'ready',
        ready_at = coalesce(ready_at, now()),
        last_action = normalized_action,
        last_action_at = now(),
        last_action_by = actor_id,
        updated_at = now()
    where id = request_row.id;
  end if;

  if normalized_note <> '' then
    update public.service_requests
    set internal_notes = concat_ws(
      E'\n',
      nullif(internal_notes, ''),
      '[' || to_char(now() at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI') || '] ' || normalized_note
    )
    where id = request_row.id;
  end if;

  select request.* into request_row
  from public.service_requests request
  where request.id = target_request_id;

  result := jsonb_build_object(
    'request_id', request_row.id,
    'request_number', request_row.request_number,
    'store_id', request_row.store_id,
    'action', normalized_action,
    'previous_status', previous_status,
    'status', request_row.status,
    'payment_status', request_row.payment_status,
    'refund_required', request_row.payment_status = 'refund_pending',
    'idempotent', false
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, payload)
  values (
    actor_id,
    'service_request_transition',
    'service_request',
    request_row.id::text,
    jsonb_build_object(
      'operation_key', operation_key,
      'store_id', request_row.store_id,
      'requested_action', normalized_action,
      'previous_status', previous_status,
      'new_status', request_row.status,
      'result', result
    )
  );

  return result;
end;
$$;

revoke all on function public.staff_transition_service_request_production(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_transition_service_request_production(uuid,uuid,text,text)
  to authenticated;

comment on function public.staff_transition_service_request_production(uuid,uuid,text,text) is
  'Inicia e conclui a etapa de produção com capacidade por loja, bloqueio de linha, idempotência e auditoria.';

do $$
declare
  production_routine regprocedure := to_regprocedure(
    'public.staff_transition_service_request_production(uuid,uuid,text,text)'
  );
  definition text;
begin
  if production_routine is null then
    raise exception 'Production service-request transition RPC was not created';
  end if;
  if has_function_privilege('anon', production_routine, 'EXECUTE') then
    raise exception 'Production service-request transition remains executable by anon';
  end if;
  if not has_function_privilege('authenticated', production_routine, 'EXECUTE') then
    raise exception 'Authenticated BFF lost the production transition RPC';
  end if;
  if not exists (
    select 1 from pg_trigger trigger_info
    where trigger_info.tgrelid = 'public.service_requests'::regclass
      and trigger_info.tgname = 'service_requests_production_capability_guard'
      and not trigger_info.tgisinternal
  ) then
    raise exception 'Production capability trigger is missing';
  end if;

  select pg_get_functiondef(production_routine::oid) into definition;
  if position('for update' in lower(definition)) = 0
     or position('private.staff_has_capability(request_row.store_id, ''manage_production'')' in definition) = 0
     or position('service_request_transition' in definition) = 0
     or position('operation_key' in definition) = 0 then
    raise exception 'Production transition lost locking, authorization, audit or idempotency';
  end if;
end;
$$;

commit;
