begin;

-- O planejamento de compras da semana (private.costing_shopping_weeks, editado
-- em Operação > Compras e Estoque > Planejar compras) e a disponibilidade
-- pública de fatias (public.flavor_availability / flavor_availability_batches,
-- que alimenta o site) são tabelas independentes: marcar um sabor no
-- planejamento nunca atualizou o que o cliente vê. Esta função dá à gestão um
-- botão de importação explícita: para cada dia marcado no planejamento dentro
-- do período escolhido, cria um lote de 13 fatias (uma torta G) por torta
-- planejada, disponível a partir das 18h, reaproveitando
-- staff_upsert_flavor_availability_batch (já audita e sincroniza
-- flavor_availability). Sabores com 0 tortas no dia são ignorados; o dia
-- continua editável manualmente depois da importação.
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
  imported_count integer := 0;
  skipped_count integer := 0;
  imported_days jsonb := '[]'::jsonb;
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
      slices := least(9999, (cakes * 13)::integer);
      perform public.staff_upsert_flavor_availability_batch(
        null, flavor_uuid, day_date, time '18:00', slices
      );
      imported_count := imported_count + 1;
      imported_days := imported_days || to_jsonb(day_date::text);
    end loop;
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.plan_imported',
    'flavor_availability_batch', null,
    jsonb_build_object(
      'start_date', start_date, 'end_date', end_date,
      'imported_count', imported_count, 'skipped_count', skipped_count
    )
  );

  return jsonb_build_object(
    'imported_count', imported_count,
    'skipped_count', skipped_count,
    'days', (select jsonb_agg(distinct value) from jsonb_array_elements(imported_days) value)
  );
end;
$$;

revoke all on function public.manager_import_shopping_plan_availability(date, date)
  from public, anon;
grant execute on function public.manager_import_shopping_plan_availability(date, date)
  to authenticated;

comment on function public.manager_import_shopping_plan_availability(date, date) is
  'Importa o planejamento de compras da semana (sabores x dia) para lotes públicos de disponibilidade: 13 fatias por torta planejada, a partir das 18h.';

commit;
