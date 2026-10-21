begin;

-- A importacao do planejamento (manager_import_shopping_plan_availability)
-- so adicionava/atualizava lotes para sabores marcados no planejamento;
-- se um sabor fosse desmarcado de um dia e a importacao rodasse de novo,
-- o lote antigo ficava esquecido no site publico. Esta migracao marca os
-- lotes criados pela importacao (imported_from_shopping_plan) para poder
-- diferencia-los de lotes que a equipe cria manualmente na tela de
-- Produtos, e refaz a funcao para tambem excluir, dentro do periodo
-- importado, os lotes marcados que nao tem mais torta correspondente no
-- planejamento atual -- sem nunca mexer em lotes criados manualmente nem
-- em lotes com fatias ja reservadas por clientes.

alter table public.flavor_availability_batches
  add column if not exists imported_from_shopping_plan boolean not null default false;

comment on column public.flavor_availability_batches.imported_from_shopping_plan is
  'true quando o lote foi criado pela importacao do planejamento de compras (manager_import_shopping_plan_availability), para a reimportacao saber quais lotes pode remover ao reconciliar.';

create or replace function public.manager_import_shopping_plan_availability(
  start_date date,
  end_date date
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
  stale record;
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
    select batch.id, batch.flavor_id, batch.service_date, batch.quantity_reserved
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
    if stale.quantity_reserved > 0 then
      removal_blocked_count := removal_blocked_count + 1;
      continue;
    end if;
    begin
      perform public.staff_delete_flavor_availability_batch(stale.id);
      removed_count := removed_count + 1;
    exception when others then
      removal_blocked_count := removal_blocked_count + 1;
    end;
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.plan_imported',
    'flavor_availability_batch', null,
    jsonb_build_object(
      'start_date', start_date, 'end_date', end_date,
      'imported_count', imported_count, 'skipped_count', skipped_count,
      'removed_count', removed_count, 'removal_blocked_count', removal_blocked_count
    )
  );

  return jsonb_build_object(
    'imported_count', imported_count,
    'skipped_count', skipped_count,
    'removed_count', removed_count,
    'removal_blocked_count', removal_blocked_count,
    'days', (select jsonb_agg(distinct value) from jsonb_array_elements(imported_days) value)
  );
end;
$$;

revoke all on function public.manager_import_shopping_plan_availability(date, date)
  from public, anon;
grant execute on function public.manager_import_shopping_plan_availability(date, date)
  to authenticated;

comment on function public.manager_import_shopping_plan_availability(date, date) is
  'Importa o planejamento de compras da semana (sabores x dia) para lotes públicos de disponibilidade: 13 fatias por torta planejada, a partir das 18h. Reconciliado: remove, dentro do período, lotes importados anteriormente cujo sabor saiu do planejamento, desde que não tenham fatias reservadas.';

commit;
