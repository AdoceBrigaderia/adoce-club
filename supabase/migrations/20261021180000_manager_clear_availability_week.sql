begin;

-- Botao "Limpar semana inteira" em Operacao > Produtos > Producao de hoje:
-- remove de uma vez todos os lotes de disponibilidade publica (de qualquer
-- origem, importados ou criados manualmente) dentro de um periodo, sem
-- nunca remover um lote que ja tenha fatias reservadas por um cliente --
-- esses ficam de fora e sao contados a parte, para a gestao resolver a
-- reserva antes de tentar de novo.
create or replace function public.manager_clear_availability_week(
  start_date date,
  end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  removed_count integer := 0;
  removal_blocked_count integer := 0;
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

  for target in
    select batch.id, batch.quantity_reserved
    from public.flavor_availability_batches batch
    where batch.active
      and batch.service_date between start_date and end_date
  loop
    if target.quantity_reserved > 0 then
      removal_blocked_count := removal_blocked_count + 1;
      continue;
    end if;
    begin
      perform public.staff_delete_flavor_availability_batch(target.id);
      removed_count := removed_count + 1;
    exception when others then
      removal_blocked_count := removal_blocked_count + 1;
    end;
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.week_cleared',
    'flavor_availability_batch', null,
    jsonb_build_object(
      'start_date', start_date, 'end_date', end_date,
      'removed_count', removed_count, 'removal_blocked_count', removal_blocked_count
    )
  );

  return jsonb_build_object(
    'removed_count', removed_count,
    'removal_blocked_count', removal_blocked_count
  );
end;
$$;

revoke all on function public.manager_clear_availability_week(date, date)
  from public, anon;
grant execute on function public.manager_clear_availability_week(date, date)
  to authenticated;

comment on function public.manager_clear_availability_week(date, date) is
  'Remove de uma vez todos os lotes de disponibilidade publica num periodo (qualquer origem), pulando os que ja tem fatias reservadas por cliente.';

commit;
