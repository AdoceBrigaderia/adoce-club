begin;

-- Variante de get_public_flavor_availability_batches para um período (não só
-- hoje): alimenta o "Cardápio da semana" da home pública, que precisa saber
-- o que já está disponível nos próximos dias sem expor a tabela de lotes
-- diretamente a anon. Mesma lógica de cálculo, particionada por
-- (sabor, dia) em vez de só sabor.
create or replace function public.get_public_flavor_availability_batches_range(
  start_date date default current_date,
  end_date date default current_date + 6
)
returns table (
  service_date date,
  id uuid,
  flavor_id uuid,
  available_from time,
  quantity_free integer
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if start_date is null or end_date is null or end_date < start_date then
    raise exception 'Escolha um período válido';
  end if;
  if end_date - start_date > 13 then
    raise exception 'Escolha um período de até 14 dias';
  end if;

  return query
  with aggregate_stock as (
    select
      availability.flavor_id,
      availability.service_date,
      greatest(
        coalesce(availability.quantity_available, 30)
          - coalesce(availability.quantity_reserved, 0),
        0
      )::integer as aggregate_free
    from public.flavor_availability availability
    where availability.service_date between start_date and end_date
      and availability.status in ('available', 'last_units', 'preorder_only')
  ), base as (
    select
      batch.id,
      batch.flavor_id,
      batch.service_date,
      batch.available_from,
      greatest(batch.quantity_available - batch.quantity_reserved, 0)::integer as free,
      aggregate_stock.aggregate_free,
      sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
        partition by batch.flavor_id, batch.service_date
      )::integer as batch_free,
      coalesce(sum(greatest(batch.quantity_available - batch.quantity_reserved, 0)) over (
        partition by batch.flavor_id, batch.service_date
        order by batch.available_from
        rows between unbounded preceding and 1 preceding
      ), 0)::integer as free_before
    from public.flavor_availability_batches batch
    join aggregate_stock
      on aggregate_stock.flavor_id = batch.flavor_id
      and aggregate_stock.service_date = batch.service_date
    where batch.service_date between start_date and end_date
      and batch.active
  )
  select
    base.service_date,
    base.id,
    base.flavor_id,
    base.available_from,
    greatest(
      base.free - least(
        base.free,
        greatest(base.batch_free - base.aggregate_free - base.free_before, 0)
      ),
      0
    )::integer as quantity_free
  from base
  order by base.service_date, base.flavor_id, base.available_from;
end;
$$;

revoke all on function public.get_public_flavor_availability_batches_range(date, date)
  from public;
grant execute on function public.get_public_flavor_availability_batches_range(date, date)
  to anon, authenticated;

comment on function public.get_public_flavor_availability_batches_range(date, date) is
  'Lotes de disponibilidade pública (quantidade livre) para um período de dias, usado pelo cardápio da semana da home pública.';

commit;
