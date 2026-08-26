-- O estoque de fatias representa unidades físicas e não pode desaparecer na
-- virada do calendário. A disponibilidade continua registrada por data para
-- preservar histórico, mas o saldo mais recente é transportado sem alteração
-- para o novo dia. Linhas já cadastradas para a data nunca são sobrescritas.

create or replace function private.carry_forward_flavor_inventory(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied_rows integer := 0;
  fortaleza_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  if target_date is null
     or target_date < fortaleza_today - 1
     or target_date > fortaleza_today + 1 then
    raise exception 'Data inválida para continuidade do estoque';
  end if;

  insert into public.flavor_availability (
    flavor_id,
    service_date,
    status,
    note,
    quantity_available,
    quantity_reserved,
    updated_by,
    updated_at
  )
  select distinct on (previous.flavor_id)
    previous.flavor_id,
    target_date,
    previous.status,
    previous.note,
    previous.quantity_available,
    previous.quantity_reserved,
    null,
    now()
  from public.flavor_availability previous
  where previous.service_date < target_date
    and not exists (
      select 1
      from public.flavor_availability current_inventory
      where current_inventory.flavor_id = previous.flavor_id
        and current_inventory.service_date = target_date
    )
  order by previous.flavor_id, previous.service_date desc, previous.updated_at desc
  on conflict (flavor_id, service_date) do nothing;

  get diagnostics copied_rows = row_count;

  if copied_rows > 0 then
    insert into public.audit_events (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      payload
    )
    values (
      null,
      'inventory.day_continued',
      'flavor_inventory',
      target_date::text,
      jsonb_build_object(
        'service_date', target_date,
        'copied_rows', copied_rows,
        'rule', 'same_balance_without_reset'
      )
    );
  end if;

  return copied_rows;
end;
$$;

revoke all on function private.carry_forward_flavor_inventory(date)
  from public, anon, authenticated;

-- Substitui qualquer agendamento anterior com o mesmo nome e executa na
-- meia-noite de Fortaleza (03:00 UTC). O comando é idempotente.
do $$
declare
  existing_job bigint;
begin
  select jobid
    into existing_job
  from cron.job
  where jobname = 'adoce-carry-forward-flavor-inventory';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'adoce-carry-forward-flavor-inventory',
    '0 3 * * *',
    'select private.carry_forward_flavor_inventory((now() at time zone ''America/Fortaleza'')::date);'
  );
end;
$$;

-- Corrige imediatamente a data atual sem alterar nenhum saldo existente.
select private.carry_forward_flavor_inventory(
  (now() at time zone 'America/Fortaleza')::date
);
