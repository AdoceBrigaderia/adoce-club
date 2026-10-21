begin;

-- O planejamento de compras agora e salvo como rascunho (ver hook
-- useShoppingPlanSync) e, ao salvar, o site publico deve sincronizar
-- sozinho (sem precisar clicar em "Importar planejamento para o site").
-- Mas nem toda remocao de lote e segura sem confirmacao: um lote pode ja
-- ter fatias reservadas por um cliente (regra do negocio: cliente so paga
-- depois que a equipe confirma que a fatia esta separada, entao cancelar
-- a reserva aqui nao envolve estorno nenhum) ou pode ter vindo do estoque
-- sobrado do dia anterior (continuidade, ainda nao vendido). Os dois casos
-- agora ficam bloqueados por padrao e sao reportados para o front-end
-- pedir confirmacao explicita; com forcar=true, a funcao cancela o pedido
-- reservado (reaproveitando staff_update_instant_order, que ja reverte a
-- reserva nas duas tabelas de disponibilidade) e remove o lote.

drop function if exists public.manager_import_shopping_plan_availability(date, date);

create or replace function public.manager_import_shopping_plan_availability(
  start_date date,
  end_date date,
  force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  week record;
  entry record;
  day_date date;
  flavor_uuid uuid;
  cakes numeric;
  slices integer;
  saved_batch public.flavor_availability_batches;
  imported_count integer := 0;
  skipped_count integer := 0;
  removed_count integer := 0;
  removal_blocked_count integer := 0;
  imported_days jsonb := '[]'::jsonb;
  blocked jsonb := '[]'::jsonb;
  stale record;
  is_carryover boolean;
  order_row record;
begin
  if not coalesce(private.is_manager(), false) then
    raise exception 'Acesso restrito à gestão';
  end if;
  if start_date is null or end_date is null or end_date < start_date then
    raise exception 'Escolha um período válido';
  end if;
  if end_date - start_date > 60 then
    raise exception 'Escolha um período de até 60 dias';
  end if;

  create temporary table desired_plan (
    service_date date not null,
    flavor_id uuid not null,
    primary key (service_date, flavor_id)
  ) on commit drop;

  for week in
    select costing.week_start, costing.plan
    from private.costing_shopping_weeks costing
    where costing.week_start <= end_date
      and costing.week_start + 6 >= start_date
  loop
    for entry in select pair.key, pair.value from jsonb_each(week.plan->'daily') pair loop
      day_date := split_part(entry.key, '|', 1)::date;
      if day_date < start_date or day_date > end_date then continue; end if;
      cakes := (entry.value)::text::numeric;
      if cakes is null or cakes <= 0 then continue; end if;
      flavor_uuid := split_part(entry.key, '|', 2)::uuid;
      if not exists (select 1 from public.flavors where id = flavor_uuid) then
        skipped_count := skipped_count + 1;
        continue;
      end if;
      insert into desired_plan(service_date, flavor_id) values (day_date, flavor_uuid)
        on conflict do nothing;
      slices := least(9999, (cakes * 13)::integer);
      saved_batch := public.staff_upsert_flavor_availability_batch(
        (
          select batch.id from public.flavor_availability_batches batch
          where batch.flavor_id = flavor_uuid
            and batch.service_date = day_date
            and batch.available_from = time '18:00'
        ),
        flavor_uuid, day_date, time '18:00', slices
      );
      update public.flavor_availability_batches
      set imported_from_shopping_plan = true
      where id = saved_batch.id;
      imported_count := imported_count + 1;
      imported_days := imported_days || to_jsonb(day_date::text);
    end loop;
  end loop;

  for stale in
    select batch.id, batch.flavor_id, batch.service_date, batch.quantity_reserved,
      (select f.name from public.flavors f where f.id = batch.flavor_id) as flavor_name
    from public.flavor_availability_batches batch
    where batch.imported_from_shopping_plan
      and batch.active
      and batch.service_date between start_date and end_date
      and not exists (
        select 1 from desired_plan plan
        where plan.service_date = batch.service_date
          and plan.flavor_id = batch.flavor_id
      )
  loop
    is_carryover := exists(
      select 1 from private.flavor_batch_continuity continuity
      where continuity.target_batch_id = stale.id
    );

    if stale.quantity_reserved > 0 and not force then
      removal_blocked_count := removal_blocked_count + 1;
      blocked := blocked || jsonb_build_object(
        'flavor_id', stale.flavor_id, 'flavor_name', stale.flavor_name,
        'service_date', stale.service_date, 'reason', 'reserved'
      );
      continue;
    end if;

    if is_carryover and stale.quantity_reserved = 0 and not force then
      removal_blocked_count := removal_blocked_count + 1;
      blocked := blocked || jsonb_build_object(
        'flavor_id', stale.flavor_id, 'flavor_name', stale.flavor_name,
        'service_date', stale.service_date, 'reason', 'carryover'
      );
      continue;
    end if;

    begin
      if stale.quantity_reserved > 0 and force then
        for order_row in
          select distinct item.order_id as order_id
          from private.instant_order_batch_allocations allocation
          join public.instant_order_items item on item.id = allocation.order_item_id
          where allocation.batch_id = stale.id and allocation.status = 'reserved'
        loop
          perform public.staff_update_instant_order(
            order_row.order_id, 'cancelled', null, null, null,
            'Fatia removida do planejamento de compras'
          );
        end loop;
      end if;
      perform public.staff_delete_flavor_availability_batch(stale.id);
      removed_count := removed_count + 1;
    exception when others then
      removal_blocked_count := removal_blocked_count + 1;
      blocked := blocked || jsonb_build_object(
        'flavor_id', stale.flavor_id, 'flavor_name', stale.flavor_name,
        'service_date', stale.service_date, 'reason', 'error'
      );
    end;
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.plan_imported',
    'flavor_availability_batch', null,
    jsonb_build_object(
      'start_date', start_date, 'end_date', end_date, 'force', force,
      'imported_count', imported_count, 'skipped_count', skipped_count,
      'removed_count', removed_count, 'removal_blocked_count', removal_blocked_count
    )
  );

  return jsonb_build_object(
    'imported_count', imported_count,
    'skipped_count', skipped_count,
    'removed_count', removed_count,
    'removal_blocked_count', removal_blocked_count,
    'blocked', blocked,
    'days', (select jsonb_agg(distinct value) from jsonb_array_elements(imported_days) value)
  );
end;
$$;

revoke all on function public.manager_import_shopping_plan_availability(date, date, boolean)
  from public, anon;
grant execute on function public.manager_import_shopping_plan_availability(date, date, boolean)
  to authenticated;

comment on function public.manager_import_shopping_plan_availability(date, date, boolean) is
  'Importa o planejamento de compras para lotes públicos de disponibilidade e reconcilia remoções. Sem forcar=true, bloqueia (e lista em "blocked") a remoção de lotes com fatias reservadas ou vindos de continuidade do dia anterior; com forcar=true, cancela o pedido reservado (via staff_update_instant_order) e remove o lote mesmo assim.';

commit;
