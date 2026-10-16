begin;

-- A continuidade usa exclusivamente o fechamento do dia imediatamente
-- anterior. Se a rotina diária for recuperada depois de já existir movimento
-- no novo dia, desconta vendas concluídas e perdas registradas hoje antes de
-- reconstruir o lote. Datas mais antigas nunca participam do cálculo.
create or replace function private.carry_forward_flavor_inventory_batches(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  source record;
  target_batch uuid;
  expected_quantity integer;
  copied integer := 0;
begin
  perform private.carry_forward_flavor_inventory(target_date);

  for source in
    select distinct on (batch.flavor_id)
      batch.id as source_batch_id,
      batch.flavor_id,
      availability.quantity_available as previous_day_quantity
    from public.flavor_availability_batches batch
    join public.flavor_availability availability
      on availability.flavor_id = batch.flavor_id
     and availability.service_date = batch.service_date
    where batch.service_date = target_date - 1
      and batch.active
      and batch.quantity_available > 0
      and availability.quantity_available > 0
      and availability.status not in ('sold_out', 'unavailable')
      and not exists (
        select 1
        from private.flavor_batch_continuity continuity
        where continuity.source_batch_id = batch.id
          and continuity.target_service_date = target_date
      )
      and not exists (
        select 1
        from public.flavor_availability_batches target
        where target.flavor_id = batch.flavor_id
          and target.service_date = target_date
      )
    order by batch.flavor_id, batch.available_from desc, batch.id
  loop
    select greatest(
      0,
      source.previous_day_quantity
      - coalesce((
          select sum(item.quantity)::integer
          from public.instant_order_items item
          join public.instant_orders customer_order on customer_order.id = item.order_id
          where item.flavor_id = source.flavor_id
            and coalesce(
              item.stock_service_date,
              (customer_order.created_at at time zone 'America/Fortaleza')::date
            ) = target_date
            and item.status = 'paid'
            and customer_order.status = 'completed'
        ), 0)
      - coalesce((
          select sum(loss.quantity)::integer
          from public.slice_losses loss
          where loss.flavor_id = source.flavor_id
            and loss.service_date = target_date
        ), 0)
    ) into expected_quantity;

    if expected_quantity <= 0 then
      continue;
    end if;

    update public.flavor_availability
    set quantity_available = greatest(quantity_available, expected_quantity),
        status = case
          when greatest(quantity_available, expected_quantity) <= quantity_reserved
            then 'sold_out'::public.availability_status
          when greatest(quantity_available, expected_quantity) - quantity_reserved <= 3
            then 'last_units'::public.availability_status
          else 'available'::public.availability_status
        end,
        updated_at = now()
    where flavor_id = source.flavor_id
      and service_date = target_date;

    -- O gatilho capture_unbatched_inventory_increase cria automaticamente o
    -- lote faltante às 00:00 quando o agregado aumenta. Reaproveitá-lo evita
    -- duplicar fisicamente a mesma quantidade em um segundo lote.
    select id into target_batch
    from public.flavor_availability_batches
    where flavor_id = source.flavor_id
      and service_date = target_date
      and available_from = time '00:00'
    order by created_at desc
    limit 1
    for update;

    if target_batch is null then
      continue;
    end if;

    update public.flavor_availability_batches
    set available_from = time '08:00', updated_at = now()
    where id = target_batch;

    insert into private.flavor_batch_continuity(
      source_batch_id, target_batch_id, target_service_date, carried_quantity
    ) values (
      source.source_batch_id, target_batch, target_date, expected_quantity
    )
    on conflict (source_batch_id, target_service_date) do nothing;

    copied := copied + 1;
  end loop;

  if copied > 0 then
    insert into public.audit_events(
      actor_user_id, action, entity_type, entity_id, payload
    ) values (
      null,
      'inventory.batch_continued',
      'flavor_inventory_batch',
      target_date::text,
      jsonb_build_object(
        'service_date', target_date,
        'copied_batches', copied,
        'available_from', '08:00',
        'rule', 'previous_day_minus_current_day_movements'
      )
    );
  end if;

  return copied;
end;
$$;

revoke all on function private.carry_forward_flavor_inventory_batches(date)
  from public, anon, authenticated;

-- 03:05 UTC corresponde a 00:05 em Fortaleza: o saldo de ontem passa a
-- existir antes do início normal da operação, em vez de somente às 08:00.
do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'adoce-carry-forward-flavor-inventory';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'adoce-carry-forward-flavor-inventory',
    '5 3 * * *',
    'select private.carry_forward_flavor_inventory_batches((now() at time zone ''America/Fortaleza'')::date);'
  );
end;
$$;

select private.carry_forward_flavor_inventory_batches(
  (now() at time zone 'America/Fortaleza')::date
);

commit;
