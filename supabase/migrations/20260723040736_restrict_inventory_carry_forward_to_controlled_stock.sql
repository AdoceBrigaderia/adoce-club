-- Somente saldos com controle numérico representam estoque físico. Registros
-- históricos marcados como "sem controle" não podem reaparecer como produtos
-- disponíveis em um novo dia.

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
    and previous.quantity_available is not null
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
        'rule', 'same_controlled_balance_without_reset'
      )
    );
  end if;

  return copied_rows;
end;
$$;

revoke all on function private.carry_forward_flavor_inventory(date)
  from public, anon, authenticated;

-- Remove exclusivamente as linhas sem saldo numérico criadas pela primeira
-- execução automática desta data. Ajustes feitos por usuários não entram aqui.
delete from public.flavor_availability availability
using public.audit_events event
where event.action = 'inventory.day_continued'
  and event.entity_id = ((now() at time zone 'America/Fortaleza')::date)::text
  and availability.service_date = (now() at time zone 'America/Fortaleza')::date
  and availability.quantity_available is null
  and availability.updated_by is null
  and availability.updated_at between event.created_at - interval '2 seconds'
                                  and event.created_at + interval '2 seconds';
